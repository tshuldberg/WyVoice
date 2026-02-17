#import "SwiftBridge.h"
#import <CoreGraphics/CoreGraphics.h>
#import <ApplicationServices/ApplicationServices.h>

@implementation KeyboardBridge

+ (void)typeText:(NSString *)text delayMs:(int)delay {
    NSLog(@"[MyVoice] KeyboardBridge.typeText called: \"%@\" (delay=%dms)", text, delay);

    BOOL trusted = AXIsProcessTrusted();
    NSLog(@"[MyVoice] Accessibility trusted: %@", trusted ? @"YES" : @"NO");

    CGEventSourceRef source = CGEventSourceCreate(kCGEventSourceStateHIDSystemState);
    if (!source) {
        NSLog(@"[MyVoice] ERROR: Failed to create CGEventSource");
        return;
    }

    for (NSUInteger i = 0; i < text.length; i++) {
        unichar character = [text characterAtIndex:i];
        UniChar uniChar = (UniChar)character;

        // Create key down event
        CGEventRef keyDown = CGEventCreateKeyboardEvent(source, 0, true);
        CGEventKeyboardSetUnicodeString(keyDown, 1, &uniChar);
        CGEventPost(kCGHIDEventTap, keyDown);
        CFRelease(keyDown);

        // Create key up event
        CGEventRef keyUp = CGEventCreateKeyboardEvent(source, 0, false);
        CGEventKeyboardSetUnicodeString(keyUp, 1, &uniChar);
        CGEventPost(kCGHIDEventTap, keyUp);
        CFRelease(keyUp);

        // Delay between keystrokes
        if (delay > 0) {
            usleep(delay * 1000); // Convert ms to microseconds
        }
    }

    if (source) {
        CFRelease(source);
    }

    NSLog(@"[MyVoice] KeyboardBridge.typeText finished (%lu chars)", (unsigned long)text.length);
}

+ (void)pasteFromClipboard {
    NSLog(@"[MyVoice] KeyboardBridge.pasteFromClipboard called");

    BOOL trusted = AXIsProcessTrusted();
    NSLog(@"[MyVoice] Accessibility trusted: %@", trusted ? @"YES" : @"NO");

    CGEventSourceRef source = CGEventSourceCreate(kCGEventSourceStateHIDSystemState);
    if (!source) {
        NSLog(@"[MyVoice] ERROR: Failed to create CGEventSource");
        return;
    }

    // Simulate Cmd+V (keycode 9 = V on macOS)
    CGEventRef keyDown = CGEventCreateKeyboardEvent(source, 9, true);
    CGEventSetFlags(keyDown, kCGEventFlagMaskCommand);
    CGEventPost(kCGHIDEventTap, keyDown);
    CFRelease(keyDown);

    CGEventRef keyUp = CGEventCreateKeyboardEvent(source, 9, false);
    CGEventSetFlags(keyUp, kCGEventFlagMaskCommand);
    CGEventPost(kCGHIDEventTap, keyUp);
    CFRelease(keyUp);

    CFRelease(source);
    NSLog(@"[MyVoice] Cmd+V posted");
}

+ (BOOL)checkAccessibilityPermission {
    NSDictionary *options = @{(__bridge NSString *)kAXTrustedCheckOptionPrompt: @NO};
    return AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)options);
}

+ (void)requestAccessibilityPermission {
    NSDictionary *options = @{(__bridge NSString *)kAXTrustedCheckOptionPrompt: @YES};
    AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)options);
}

@end
