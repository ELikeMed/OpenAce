// event-monitor.swift — Captures real mouse clicks and keyboard events on macOS.
// Outputs JSON lines to stdout so Node.js can read them.
// Compile: swiftc scripts/event-monitor.swift -o scripts/event-monitor
// Usage:   ./scripts/event-monitor (Ctrl+C to stop)
// Requires: Accessibility permission for the parent Terminal/IDE app.

import Cocoa
import CoreGraphics

// Flush stdout on every print
setbuf(stdout, nil)

// Event mask: left click down/up, right click down, key down, scroll wheel
let eventMask: CGEventMask = (
    (1 << CGEventType.leftMouseDown.rawValue) |
    (1 << CGEventType.leftMouseUp.rawValue) |
    (1 << CGEventType.rightMouseDown.rawValue) |
    (1 << CGEventType.keyDown.rawValue) |
    (1 << CGEventType.scrollWheel.rawValue)
)

// Callback for each event
func eventCallback(proxy: CGEventTapProxy, type: CGEventType, event: CGEvent, refcon: UnsafeMutableRawPointer?) -> Unmanaged<CGEvent>? {
    let timestamp = Int(Date().timeIntervalSince1970 * 1000)

    switch type {
    case .leftMouseDown, .rightMouseDown:
        let loc = event.location
        let button = type == .leftMouseDown ? "left" : "right"
        print("{\"type\":\"click\",\"button\":\"\(button)\",\"x\":\(Int(loc.x)),\"y\":\(Int(loc.y)),\"ts\":\(timestamp)}")

    case .leftMouseUp:
        let loc = event.location
        print("{\"type\":\"mouseUp\",\"x\":\(Int(loc.x)),\"y\":\(Int(loc.y)),\"ts\":\(timestamp)}")

    case .keyDown:
        let keyCode = event.getIntegerValueField(.keyboardEventKeycode)
        let flags = event.flags
        // Get the character
        var char = ""
        if let characters = CGEvent(keyboardEventSource: nil, virtualKey: CGKeyCode(keyCode), keyDown: true) {
            let nsEvent = NSEvent(cgEvent: characters)
            char = nsEvent?.characters ?? ""
        }
        // Detect modifier keys
        var mods: [String] = []
        if flags.contains(.maskCommand) { mods.append("command") }
        if flags.contains(.maskShift) { mods.append("shift") }
        if flags.contains(.maskAlternate) { mods.append("option") }
        if flags.contains(.maskControl) { mods.append("control") }

        // Map common key codes to names
        let keyName: String
        switch keyCode {
        case 36: keyName = "return"
        case 48: keyName = "tab"
        case 49: keyName = "space"
        case 51: keyName = "delete"
        case 53: keyName = "escape"
        case 123: keyName = "left"
        case 124: keyName = "right"
        case 125: keyName = "down"
        case 126: keyName = "up"
        default: keyName = char
        }

        let modsJson = mods.isEmpty ? "[]" : "[\"\(mods.joined(separator: "\",\""))\"]"
        print("{\"type\":\"key\",\"key\":\"\(keyName)\",\"keyCode\":\(keyCode),\"modifiers\":\(modsJson),\"ts\":\(timestamp)}")

    case .scrollWheel:
        let deltaY = event.getIntegerValueField(.scrollWheelEventDeltaAxis1)
        let direction = deltaY > 0 ? "up" : "down"
        let loc = event.location
        print("{\"type\":\"scroll\",\"direction\":\"\(direction)\",\"x\":\(Int(loc.x)),\"y\":\(Int(loc.y)),\"ts\":\(timestamp)}")

    default:
        break
    }

    return Unmanaged.passRetained(event)
}

// Create event tap (listen-only, doesn't block events)
guard let tap = CGEvent.tapCreate(
    tap: .cgSessionEventTap,
    place: .headInsertEventTap,
    options: .listenOnly,
    eventsOfInterest: eventMask,
    callback: eventCallback,
    userInfo: nil
) else {
    fputs("ERROR: Failed to create event tap. Grant Accessibility permission.\n", stderr)
    exit(1)
}

// Wire into run loop
let runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, .commonModes)
CGEvent.tapEnable(tap: tap, enable: true)

fputs("EVENT_MONITOR_READY\n", stderr)

// Run forever (parent process kills us)
CFRunLoopRun()
