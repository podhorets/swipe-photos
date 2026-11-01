// Builds a test photo library: originals with spread-out EXIF dates,
// near-duplicate bursts (for similar detection), blurry shots, and
// "On This Day" photos dated today's month/day in earlier years.
import Foundation
import CoreImage
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
let src = URL(fileURLWithPath: args[1]), out = URL(fileURLWithPath: args[2])
try? FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
let ctx = CIContext()
var rng = SystemRandomNumberGenerator()
let fmt = DateFormatter(); fmt.dateFormat = "yyyy:MM:dd HH:mm:ss"; fmt.locale = Locale(identifier: "en_US_POSIX")
let now = Date(), cal = Calendar.current

func write(_ img: CIImage, _ name: String, _ date: Date) {
    guard let cg = ctx.createCGImage(img, from: img.extent),
          let dest = CGImageDestinationCreateWithURL(out.appendingPathComponent(name) as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else { print("fail \(name)"); return }
    let d = fmt.string(from: date)
    let props: [CFString: Any] = [
        kCGImageDestinationLossyCompressionQuality: 0.85,
        kCGImagePropertyExifDictionary: [kCGImagePropertyExifDateTimeOriginal: d, kCGImagePropertyExifDateTimeDigitized: d],
        kCGImagePropertyTIFFDictionary: [kCGImagePropertyTIFFDateTime: d],
    ]
    CGImageDestinationAddImage(dest, cg, props as CFDictionary)
    CGImageDestinationFinalize(dest)
}

func randomDate() -> Date { now.addingTimeInterval(-Double.random(in: 3600...(3 * 365 * 86400), using: &rng)) }

let files = try FileManager.default.contentsOfDirectory(atPath: src.path).filter { $0.hasSuffix(".jpg") }.sorted()
var counts = (orig: 0, onThisDay: 0, similar: 0, blurry: 0)

for (i, f) in files.enumerated() {
    guard let img = CIImage(contentsOf: src.appendingPathComponent(f)) else { continue }
    let base = (f as NSString).deletingPathExtension
    var date = randomDate()
    // ~8%: same month/day in a previous year
    if i % 12 == 5 {
        date = cal.date(byAdding: .year, value: -(1 + i % 3), to: now)!
            .addingTimeInterval(-Double.random(in: 0...36000, using: &rng))
        counts.onThisDay += 1
    }
    write(img, "\(base).jpg", date); counts.orig += 1

    // ~10%: burst of 2–3 near-duplicates seconds later
    if i % 10 == 3 {
        for k in 1...(2 + i % 2) {
            let inset = CGFloat(k) * img.extent.width * 0.025
            let v = img.cropped(to: img.extent.insetBy(dx: inset, dy: inset))
                .applyingFilter("CIColorControls", parameters: [kCIInputBrightnessKey: Double(k) * 0.02])
            write(v, "\(base)_sim\(k).jpg", date.addingTimeInterval(Double(k) * 1.5)); counts.similar += 1
        }
    }
    // ~6%: blurry retake
    if i % 16 == 9 {
        let b = img.clampedToExtent().applyingGaussianBlur(sigma: 14).cropped(to: img.extent)
        write(b, "\(base)_blur.jpg", date.addingTimeInterval(2)); counts.blurry += 1
    }
}
print("originals=\(counts.orig) onThisDay=\(counts.onThisDay) similar=\(counts.similar) blurry=\(counts.blurry) total=\(counts.orig + counts.similar + counts.blurry)")
