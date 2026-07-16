Pod::Spec.new do |s|
  s.name           = 'PhotoAnalyzer'
  s.version        = '1.0.0'
  s.summary        = 'On-device photo analysis module'
  s.description    = 'Blur detection, face counting and visual similarity grouping via the iOS Vision framework'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '13.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
