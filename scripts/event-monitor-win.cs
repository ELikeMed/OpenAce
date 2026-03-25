// event-monitor-win.cs — Captures real mouse clicks and keyboard events on Windows.
// Outputs JSON lines to stdout so Node.js can read them (same format as macOS Swift binary).
// Compile: csc /out:scripts\event-monitor-win.exe scripts\event-monitor-win.cs
// Usage:   scripts\event-monitor-win.exe (Ctrl+C to stop)
// Requires: .NET Framework (ships with Windows)

using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

class EventMonitor
{
    // Hook types
    private const int WH_MOUSE_LL = 14;
    private const int WH_KEYBOARD_LL = 13;

    // Mouse messages
    private const int WM_LBUTTONDOWN = 0x0201;
    private const int WM_LBUTTONUP = 0x0202;
    private const int WM_RBUTTONDOWN = 0x0204;
    private const int WM_MOUSEWHEEL = 0x020A;

    // Keyboard messages
    private const int WM_KEYDOWN = 0x0100;
    private const int WM_SYSKEYDOWN = 0x0104;

    private static IntPtr mouseHookId = IntPtr.Zero;
    private static IntPtr keyboardHookId = IntPtr.Zero;

    // P/Invoke declarations
    private delegate IntPtr LowLevelHookProc(int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelHookProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll")]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll")]
    private static extern IntPtr GetModuleHandle(string lpModuleName);

    [DllImport("user32.dll")]
    private static extern short GetKeyState(int nVirtKey);

    [DllImport("user32.dll")]
    private static extern int ToUnicode(uint wVirtKey, uint wScanCode, byte[] lpKeyState, [Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pwszBuff, int cchBuff, uint wFlags);

    [DllImport("user32.dll")]
    private static extern bool GetKeyboardState(byte[] lpKeyState);

    // Structs
    [StructLayout(LayoutKind.Sequential)]
    private struct MSLLHOOKSTRUCT
    {
        public int x;
        public int y;
        public uint mouseData;
        public uint flags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct KBDLLHOOKSTRUCT
    {
        public uint vkCode;
        public uint scanCode;
        public uint flags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    // Keep delegates alive (prevent GC)
    private static LowLevelHookProc mouseProc = MouseCallback;
    private static LowLevelHookProc keyboardProc = KeyboardCallback;

    static long GetTimestamp()
    {
        return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    }

    static string EscapeJson(string s)
    {
        return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "\\r").Replace("\t", "\\t");
    }

    static IntPtr MouseCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            var info = Marshal.PtrToStructure<MSLLHOOKSTRUCT>(lParam);
            long ts = GetTimestamp();
            int msg = (int)wParam;

            if (msg == WM_LBUTTONDOWN)
            {
                Console.WriteLine($"{{\"type\":\"click\",\"button\":\"left\",\"x\":{info.x},\"y\":{info.y},\"ts\":{ts}}}");
                Console.Out.Flush();
            }
            else if (msg == WM_LBUTTONUP)
            {
                Console.WriteLine($"{{\"type\":\"mouseUp\",\"x\":{info.x},\"y\":{info.y},\"ts\":{ts}}}");
                Console.Out.Flush();
            }
            else if (msg == WM_RBUTTONDOWN)
            {
                Console.WriteLine($"{{\"type\":\"click\",\"button\":\"right\",\"x\":{info.x},\"y\":{info.y},\"ts\":{ts}}}");
                Console.Out.Flush();
            }
            else if (msg == WM_MOUSEWHEEL)
            {
                short delta = (short)((info.mouseData >> 16) & 0xFFFF);
                string direction = delta > 0 ? "up" : "down";
                Console.WriteLine($"{{\"type\":\"scroll\",\"direction\":\"{direction}\",\"x\":{info.x},\"y\":{info.y},\"ts\":{ts}}}");
                Console.Out.Flush();
            }
        }
        return CallNextHookEx(mouseHookId, nCode, wParam, lParam);
    }

    static IntPtr KeyboardCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0 && ((int)wParam == WM_KEYDOWN || (int)wParam == WM_SYSKEYDOWN))
        {
            var info = Marshal.PtrToStructure<KBDLLHOOKSTRUCT>(lParam);
            long ts = GetTimestamp();
            uint vk = info.vkCode;

            // Detect modifiers
            StringBuilder mods = new StringBuilder("[");
            bool hasCtrl = (GetKeyState(0x11) & 0x8000) != 0;  // VK_CONTROL
            bool hasShift = (GetKeyState(0x10) & 0x8000) != 0; // VK_SHIFT
            bool hasAlt = (GetKeyState(0x12) & 0x8000) != 0;   // VK_MENU
            bool hasWin = (GetKeyState(0x5B) & 0x8000) != 0;   // VK_LWIN

            bool first = true;
            if (hasCtrl) { mods.Append("\"control\""); first = false; }
            if (hasShift) { if (!first) mods.Append(","); mods.Append("\"shift\""); first = false; }
            if (hasAlt) { if (!first) mods.Append(","); mods.Append("\"option\""); first = false; }
            if (hasWin) { if (!first) mods.Append(","); mods.Append("\"command\""); }
            mods.Append("]");

            // Map virtual key codes to key names
            string keyName;
            switch (vk)
            {
                case 0x0D: keyName = "return"; break;
                case 0x09: keyName = "tab"; break;
                case 0x20: keyName = "space"; break;
                case 0x08: keyName = "delete"; break;
                case 0x1B: keyName = "escape"; break;
                case 0x25: keyName = "left"; break;
                case 0x26: keyName = "up"; break;
                case 0x27: keyName = "right"; break;
                case 0x28: keyName = "down"; break;
                case 0x2E: keyName = "delete"; break; // DEL key
                default:
                    // Try to get the character
                    byte[] keyState = new byte[256];
                    GetKeyboardState(keyState);
                    StringBuilder chars = new StringBuilder(4);
                    int result = ToUnicode(vk, info.scanCode, keyState, chars, chars.Capacity, 0);
                    if (result > 0)
                        keyName = EscapeJson(chars.ToString().Substring(0, result));
                    else
                        keyName = $"vk{vk}";
                    break;
            }

            Console.WriteLine($"{{\"type\":\"key\",\"key\":\"{EscapeJson(keyName)}\",\"keyCode\":{vk},\"modifiers\":{mods},\"ts\":{ts}}}");
            Console.Out.Flush();
        }
        return CallNextHookEx(keyboardHookId, nCode, wParam, lParam);
    }

    [STAThread]
    static void Main()
    {
        // Install hooks
        using (var curProcess = Process.GetCurrentProcess())
        using (var curModule = curProcess.MainModule)
        {
            IntPtr hMod = GetModuleHandle(curModule.ModuleName);
            mouseHookId = SetWindowsHookEx(WH_MOUSE_LL, mouseProc, hMod, 0);
            keyboardHookId = SetWindowsHookEx(WH_KEYBOARD_LL, keyboardProc, hMod, 0);
        }

        if (mouseHookId == IntPtr.Zero || keyboardHookId == IntPtr.Zero)
        {
            Console.Error.WriteLine("ERROR: Failed to install input hooks. Run as administrator.");
            Environment.Exit(1);
        }

        // Signal ready (same as macOS Swift binary)
        Console.Error.WriteLine("EVENT_MONITOR_READY");
        Console.Error.Flush();

        // Handle Ctrl+C gracefully
        Console.CancelKeyPress += (sender, e) =>
        {
            e.Cancel = true;
            UnhookWindowsHookEx(mouseHookId);
            UnhookWindowsHookEx(keyboardHookId);
            Environment.Exit(0);
        };

        // Run message pump (required for low-level hooks)
        Application.Run();
    }
}
