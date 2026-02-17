{
  "targets": [
    {
      "target_name": "myvoice_native",
      "sources": [
        "Sources/addon.mm",
        "Sources/SpeechBridgeImpl.m",
        "Sources/HotkeyBridgeImpl.m",
        "Sources/KeyboardBridgeImpl.m"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "include"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS"
      ],
      "libraries": [
        "-framework Foundation",
        "-framework AppKit",
        "-framework AVFoundation",
        "-framework CoreGraphics",
        "-framework ApplicationServices"
      ],
      "xcode_settings": {
        "CLANG_ENABLE_OBJC_ARC": "YES",
        "MACOSX_DEPLOYMENT_TARGET": "13.0",
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES"
      },
      "cflags_cc": ["-std=c++17", "-ObjC++"],
      "cflags": ["-ObjC"]
    }
  ]
}
