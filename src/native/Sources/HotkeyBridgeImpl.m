#import "SwiftBridge.h"
#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>

@implementation HotkeyBridge

static id globalMonitor;
static NSDate *lastFnDownTime;
static BOOL fnCurrentlyDown;
static double doubleTapThreshold = 0.4; // 400ms

+ (void)startMonitoringWithCallback:(void (^)(void))doubleTapCallback {
    [self stopMonitoring];

    lastFnDownTime = nil;
    fnCurrentlyDown = NO;

    // Use NSEvent global monitor for flags changed events
    globalMonitor = [NSEvent addGlobalMonitorForEventsMatchingMask:NSEventMaskFlagsChanged
        handler:^(NSEvent * _Nonnull event) {

        BOOL fnDown = (event.modifierFlags & NSEventModifierFlagFunction) != 0;

        // Detect fn key transition: up -> down
        if (fnDown && !fnCurrentlyDown) {
            NSDate *now = [NSDate date];

            if (lastFnDownTime) {
                NSTimeInterval interval = [now timeIntervalSinceDate:lastFnDownTime];

                if (interval < doubleTapThreshold) {
                    // Double-tap detected!
                    doubleTapCallback();
                    lastFnDownTime = nil;
                    fnCurrentlyDown = fnDown;
                    return;
                }
            }

            lastFnDownTime = now;
        }

        fnCurrentlyDown = fnDown;
    }];

    if (!globalMonitor) {
        NSLog(@"MyVoice: Failed to create global event monitor. Check Accessibility permissions.");
    }
}

+ (void)stopMonitoring {
    if (globalMonitor) {
        [NSEvent removeMonitor:globalMonitor];
        globalMonitor = nil;
    }
    lastFnDownTime = nil;
    fnCurrentlyDown = NO;
}

@end
