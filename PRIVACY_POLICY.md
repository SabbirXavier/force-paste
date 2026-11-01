# Privacy Policy for ForcePaste

**Last Updated:** October 30, 2026

This Privacy Policy applies to the **ForcePaste: Smart Paste & Key Shield** browser extension (referred to as "the Extension", "we", "our", or "us").

---

### 1. Overview
ForcePaste is built with privacy by design. The Extension operates entirely within your local browser environment. We do not collect, track, store, transmit, or monetize any of your personal data, clipboard contents, browsing activity, or keystrokes.

---

### 2. Permissions & Data Handling

The Extension requests specific browser permissions solely to deliver its core functionality:

* **`clipboardRead`**:  
  Used exclusively when you deliberately trigger an action (clicking the floating "Paste" button or pressing the <kbd>Alt</kbd> + <kbd>V</kbd> shortcut). The clipboard text is read into local browser memory solely to type it into the currently focused input field. It is **never** saved, recorded, or transmitted.

* **`storage`**:  
  Used solely to store your personal extension settings (such as chosen typing speed profile, toggle preferences for the floating icon, and feature unblock preferences) locally on your device via Chrome's local storage API.

* **`activeTab` & Content Scripts**:  
  Used solely to locate the active text input element on the webpage you are currently viewing and inject simulated keystroke events. No webpage content, URLs, or browsing history are logged or collected.

* **`offscreen`**:  
  Used to reliably execute asynchronous clipboard access in Manifest V3 without interrupting your active browsing session.

* **`tabs`**:  
  Used solely to display currently open tabs in the Always Active Tab drawer so you can view, select, and manage which tabs stay active in the background, and to switch window/tab focus on click. Tab titles and URLs are processed strictly locally in your browser and are never transmitted or stored.

* **`contextMenus`**:  
  Used solely to create browser right-click options for looking up definitions and extracting text from protected webpage elements.

---

### 3. No Remote Servers & No Third-Party Analytics
* The Extension does not connect to any external servers, APIs, databases, or cloud services.
* The Extension contains **zero** third-party trackers, analytics libraries, advertising SDKs, or telemetry tools.
* All processing happens 100% locally and offline on your computer.

---

### 4. Children’s Privacy
The Extension does not knowingly collect any personal identifiable information from anyone, including children under the age of 13.

---

### 5. Changes to This Privacy Policy
If we update or modify this Privacy Policy in future versions, the changes will be posted in this document with an updated revision date.

---

### 6. Contact
If you have any questions, feedback, or concerns regarding this Privacy Policy, please open an issue in the project's official support repository.
