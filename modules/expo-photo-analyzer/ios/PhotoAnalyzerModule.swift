import CoreGraphics
import ExpoModulesCore
import Photos
import Vision

struct AnalyzeOptions: Record {
  @Field var blur: Bool = true
  @Field var faces: Bool = false
  @Field var maxDimension: Int = 320
}

public class PhotoAnalyzerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PhotoAnalyzer")

    // Analyzes photos by their MediaLibrary asset ids (PHAsset localIdentifiers).
    // Returns one entry per requested id, in the same order:
    //   { id, blurScore: Double?, faceCount: Int?, error: String? }
    // blurScore is the variance of the Laplacian on a grayscale thumbnail —
    // lower means blurrier. Assets that are not images or whose pixels are not
    // available locally (e.g. iCloud-offloaded with no thumbnail) get an error
    // string instead of scores.
    AsyncFunction("analyzeAssets") { (assetIds: [String], options: AnalyzeOptions?, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        let opts = options ?? AnalyzeOptions()
        promise.resolve(PhotoAnalyzer.analyzeAssets(assetIds: assetIds, options: opts))
      }
    }

    // Refines candidate groups (typically photos taken close together in time)
    // into groups of visually similar photos using Vision feature prints.
    // Input order inside each group is preserved; only sub-groups with 2+
    // members are returned.
    AsyncFunction("groupSimilarAssets") { (candidateGroups: [[String]], threshold: Double, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        promise.resolve(PhotoAnalyzer.groupSimilar(candidateGroups: candidateGroups, threshold: Float(threshold)))
      }
    }
  }
}

enum PhotoAnalyzer {
  static func analyzeAssets(assetIds: [String], options: AnalyzeOptions) -> [[String: Any?]] {
    let assets = fetchAssets(assetIds)
    var results: [[String: Any?]] = []
    results.reserveCapacity(assetIds.count)

    for id in assetIds {
      autoreleasepool {
        guard let asset = assets[id] else {
          results.append(["id": id, "blurScore": nil, "faceCount": nil, "error": "asset-not-found"])
          return
        }
        guard asset.mediaType == .image else {
          results.append(["id": id, "blurScore": nil, "faceCount": nil, "error": "not-an-image"])
          return
        }
        guard let cgImage = requestCGImage(for: asset, maxDimension: CGFloat(options.maxDimension)) else {
          results.append(["id": id, "blurScore": nil, "faceCount": nil, "error": "image-unavailable"])
          return
        }

        var entry: [String: Any?] = ["id": id, "blurScore": nil, "faceCount": nil, "error": nil]
        if options.blur {
          entry["blurScore"] = blurScore(cgImage: cgImage)
        }
        if options.faces {
          entry["faceCount"] = faceCount(cgImage: cgImage)
        }
        results.append(entry)
      }
    }

    return results
  }

  static func groupSimilar(candidateGroups: [[String]], threshold: Float) -> [[String]] {
    // JS thresholds are calibrated for feature-print revision 2 (iOS 17+),
    // where similar photos score ≲0.6. Revision 1 (iOS 15/16) distances live
    // on a much larger scale (similar shots ≈ 10), so scale accordingly.
    let effectiveThreshold: Float
    if #available(iOS 17.0, *) {
      effectiveThreshold = threshold
    } else {
      effectiveThreshold = threshold * 16.0
    }

    var refined: [[String]] = []

    for group in candidateGroups {
      guard group.count >= 2 else { continue }

      let assets = fetchAssets(group)
      var prints: [String: VNFeaturePrintObservation] = [:]
      for id in group {
        autoreleasepool {
          guard let asset = assets[id], asset.mediaType == .image,
                let cgImage = requestCGImage(for: asset, maxDimension: 360) else {
            return
          }
          if let observation = featurePrint(cgImage: cgImage) {
            prints[id] = observation
          }
        }
      }

      // Photos inside a candidate group are already ordered by creation time.
      // Chain neighbors: a photo stays in the current sub-group while its
      // distance to the previous photo is within the threshold.
      var current: [String] = []
      var previousPrint: VNFeaturePrintObservation?

      func flush() {
        if current.count >= 2 { refined.append(current) }
        current = []
        previousPrint = nil
      }

      for id in group {
        guard let print = prints[id] else {
          flush()
          continue
        }
        if let previous = previousPrint {
          var distance = Float(0)
          let comparable = (try? print.computeDistance(&distance, to: previous)) != nil
          if comparable && distance <= effectiveThreshold {
            current.append(id)
          } else {
            flush()
            current = [id]
          }
        } else {
          current = [id]
        }
        previousPrint = print
      }
      flush()
    }

    return refined
  }

  private static func fetchAssets(_ ids: [String]) -> [String: PHAsset] {
    let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: ids, options: nil)
    var map: [String: PHAsset] = [:]
    fetchResult.enumerateObjects { asset, _, _ in
      map[asset.localIdentifier] = asset
    }
    return map
  }

  private static func requestCGImage(for asset: PHAsset, maxDimension: CGFloat) -> CGImage? {
    let options = PHImageRequestOptions()
    options.isSynchronous = true
    options.deliveryMode = .highQualityFormat
    options.resizeMode = .fast
    // Never pull originals from iCloud during a scan; if no local thumbnail
    // exists the asset is reported as image-unavailable instead.
    options.isNetworkAccessAllowed = false

    var result: CGImage?
    PHImageManager.default().requestImage(
      for: asset,
      targetSize: CGSize(width: maxDimension, height: maxDimension),
      contentMode: .aspectFit,
      options: options
    ) { image, _ in
      result = image?.cgImage
    }
    return result
  }

  // Variance of the 4-neighbor Laplacian over a grayscale render of the image.
  // Sharp images produce high variance; blurred images produce low variance.
  private static func blurScore(cgImage: CGImage) -> Double? {
    let width = cgImage.width
    let height = cgImage.height
    guard width > 2, height > 2 else { return nil }

    var pixels = [UInt8](repeating: 0, count: width * height)
    let colorSpace = CGColorSpaceCreateDeviceGray()
    guard let context = CGContext(
      data: &pixels,
      width: width,
      height: height,
      bitsPerComponent: 8,
      bytesPerRow: width,
      space: colorSpace,
      bitmapInfo: CGImageAlphaInfo.none.rawValue
    ) else { return nil }

    context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))

    var sum = 0.0
    var sumOfSquares = 0.0
    for y in 1..<(height - 1) {
      let row = y * width
      for x in 1..<(width - 1) {
        let index = row + x
        let laplacian = Double(
          Int(pixels[index - width]) + Int(pixels[index + width]) +
          Int(pixels[index - 1]) + Int(pixels[index + 1]) -
          4 * Int(pixels[index])
        )
        sum += laplacian
        sumOfSquares += laplacian * laplacian
      }
    }

    let count = Double((width - 2) * (height - 2))
    let mean = sum / count
    return sumOfSquares / count - mean * mean
  }

  private static func faceCount(cgImage: CGImage) -> Int? {
    let request = VNDetectFaceRectanglesRequest()
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    do {
      try handler.perform([request])
      return request.results?.count ?? 0
    } catch {
      return nil
    }
  }

  private static func featurePrint(cgImage: CGImage) -> VNFeaturePrintObservation? {
    let request = VNGenerateImageFeaturePrintRequest()
    // Pin the revision explicitly: the runtime default changes across iOS
    // versions and each revision uses an incompatible distance scale.
    if #available(iOS 17.0, *) {
      request.revision = VNGenerateImageFeaturePrintRequestRevision2
    } else {
      request.revision = VNGenerateImageFeaturePrintRequestRevision1
    }
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    do {
      try handler.perform([request])
      return request.results?.first as? VNFeaturePrintObservation
    } catch {
      return nil
    }
  }
}
