#import "SwiftBridge.h"
#import <AVFoundation/AVFoundation.h>

@implementation SpeechBridge

static AVAudioEngine *audioEngine;
static NSMutableData *pcmData;
static double recordingSampleRate;
static id configObserver;

+ (void)requestAuthorization:(void (^)(BOOL granted))callback {
    // No speech recognition auth needed with Whisper — just check mic access
    switch ([AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeAudio]) {
        case AVAuthorizationStatusAuthorized: {
            callback(YES);
            break;
        }
        case AVAuthorizationStatusNotDetermined: {
            [AVCaptureDevice requestAccessForMediaType:AVMediaTypeAudio completionHandler:^(BOOL granted) {
                dispatch_async(dispatch_get_main_queue(), ^{
                    callback(granted);
                });
            }];
            break;
        }
        default: {
            callback(NO);
            break;
        }
    }
}

+ (BOOL)isAvailable {
    return YES; // Whisper is always available if the binary exists
}

+ (void)startRecognitionWithLocale:(NSString *)locale
                   onPartialResult:(void (^)(NSString *text))partialCallback
                     onFinalResult:(void (^)(NSString *text))finalCallback
                      onAudioLevel:(void (^)(float level))levelCallback
                           onError:(void (^)(NSString *error))errorCallback {

    // Stop any existing session
    [self stopRecognition];

    // Set up audio engine
    audioEngine = [[AVAudioEngine alloc] init];
    AVAudioInputNode *inputNode = audioEngine.inputNode;

    // Use the hardware's native format — whisper-cli resamples internally
    AVAudioFormat *inputFormat = [inputNode outputFormatForBus:0];

    NSLog(@"[MyVoice] Input format: sampleRate=%.0f channels=%u",
          inputFormat.sampleRate, (unsigned)inputFormat.channelCount);

    if (inputFormat.channelCount == 0) {
        errorCallback(@"No audio input available. Check microphone permission.");
        return;
    }

    // Accumulate PCM data for WAV file at the hardware sample rate
    pcmData = [NSMutableData data];
    recordingSampleRate = inputFormat.sampleRate;

    NSLog(@"[MyVoice] Recording at %.0fHz for Whisper (will resample internally)",
          recordingSampleRate);

    // Install tap at native format (nil = node's output format, avoids mismatch crash)
    [inputNode installTapOnBus:0 bufferSize:4096 format:nil
        block:^(AVAudioPCMBuffer * _Nonnull buffer, AVAudioTime * _Nonnull when) {

        float *channelData = buffer.floatChannelData[0];
        if (!channelData) return;

        UInt32 frameLength = buffer.frameLength;

        // Append first channel's PCM float data for WAV file
        [pcmData appendBytes:channelData length:frameLength * sizeof(float)];

        // Calculate RMS level for waveform visualization
        float sumSquares = 0.0f;
        for (UInt32 i = 0; i < frameLength; i++) {
            sumSquares += channelData[i] * channelData[i];
        }

        float rms = sqrtf(sumSquares / (float)frameLength);
        float normalized = fminf(1.0f, rms / 0.03f);

        levelCallback(normalized);
    }];

    // Observe mic disconnect
    configObserver = [[NSNotificationCenter defaultCenter]
        addObserverForName:AVAudioEngineConfigurationChangeNotification
        object:audioEngine queue:nil usingBlock:^(NSNotification * _Nonnull note) {
        errorCallback(@"Audio input changed. Microphone may have been disconnected.");
        [self stopRecognition];
    }];

    // Start audio engine
    NSError *engineError;
    [audioEngine prepare];
    if (![audioEngine startAndReturnError:&engineError]) {
        NSLog(@"[MyVoice] Audio engine failed: %@", engineError.localizedDescription);
        errorCallback([NSString stringWithFormat:@"Audio engine failed: %@",
            engineError.localizedDescription]);
    } else {
        NSLog(@"[MyVoice] Audio engine started (recording to buffer)");
    }
}

+ (NSString *)stopAndSaveRecording {
    // Stop engine
    if (configObserver) {
        [[NSNotificationCenter defaultCenter] removeObserver:configObserver];
        configObserver = nil;
    }
    if (audioEngine && audioEngine.isRunning) {
        [audioEngine stop];
        [audioEngine.inputNode removeTapOnBus:0];
    }
    audioEngine = nil;

    if (!pcmData || pcmData.length == 0) {
        NSLog(@"[MyVoice] No audio data recorded");
        return nil;
    }

    // Write WAV file to temp directory
    NSString *tempPath = [NSTemporaryDirectory() stringByAppendingPathComponent:@"myvoice_recording.wav"];
    NSLog(@"[MyVoice] Writing WAV: %lu bytes PCM → %@", (unsigned long)pcmData.length, tempPath);

    // Build WAV header (PCM float32, mono, at hardware sample rate)
    uint32_t dataSize = (uint32_t)pcmData.length;
    uint32_t fileSize = 36 + dataSize;
    uint16_t audioFormat = 3; // IEEE float
    uint16_t numChannels = 1;
    uint32_t sampleRate = (uint32_t)recordingSampleRate;
    uint16_t bitsPerSample = 32;
    uint32_t byteRate = sampleRate * numChannels * bitsPerSample / 8;
    uint16_t blockAlign = numChannels * bitsPerSample / 8;

    NSMutableData *wavData = [NSMutableData dataWithCapacity:44 + dataSize];

    // RIFF header
    [wavData appendBytes:"RIFF" length:4];
    [wavData appendBytes:&fileSize length:4];
    [wavData appendBytes:"WAVE" length:4];

    // fmt chunk
    [wavData appendBytes:"fmt " length:4];
    uint32_t fmtSize = 16;
    [wavData appendBytes:&fmtSize length:4];
    [wavData appendBytes:&audioFormat length:2];
    [wavData appendBytes:&numChannels length:2];
    [wavData appendBytes:&sampleRate length:4];
    [wavData appendBytes:&byteRate length:4];
    [wavData appendBytes:&blockAlign length:2];
    [wavData appendBytes:&bitsPerSample length:2];

    // data chunk
    [wavData appendBytes:"data" length:4];
    [wavData appendBytes:&dataSize length:4];
    [wavData appendData:pcmData];

    [wavData writeToFile:tempPath atomically:YES];

    pcmData = nil;

    float durationSec = (float)dataSize / (float)(sampleRate * numChannels * bitsPerSample / 8);
    NSLog(@"[MyVoice] WAV written: %.1f seconds, %u bytes", durationSec, (unsigned)(44 + dataSize));

    return tempPath;
}

+ (void)stopRecognition {
    if (configObserver) {
        [[NSNotificationCenter defaultCenter] removeObserver:configObserver];
        configObserver = nil;
    }
    if (audioEngine) {
        if (audioEngine.isRunning) {
            [audioEngine stop];
            [audioEngine.inputNode removeTapOnBus:0];
        }
    }
    audioEngine = nil;
    pcmData = nil;
}

@end
