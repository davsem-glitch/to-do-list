DAYLIGHT — SMART TO-DO & PRODUCTIVITY APP

OVERVIEW
Daylight is a responsive, single-page productivity app built with plain HTML, CSS,
and JavaScript. It does not require a build step, package manager, or third-party
runtime dependency.

TASK MANAGEMENT
- Create, edit, complete, and permanently delete tasks (with confirmation)
- Four priority levels: Urgent, High, Medium, and Low
- Due dates and times, custom categories, and comma-separated tags
- Interactive task checklists with per-item completion saved locally
- Daily, weekly, and monthly recurring tasks
- Instant search across task titles, descriptions, categories, tags, and checklist items
- Filters for status, priority, category, and date
- Sort by priority, deadline, creation date, or saved manual order
- Drag and drop tasks to reorder them (desktop pointer input); move-up/down controls are also available in manual-order mode

DASHBOARD & PRODUCTIVITY
- Total tasks, today's tasks, today's completed/pending, overdue, and next-7-day counts
- Today's completion percentage and a configurable daily completion goal
- Smart day planner that suggests a top-three order from priority and deadline
- Recently completed tasks
- Focus mode to hide navigation and secondary dashboard cards
- Pomodoro focus timer with 25-minute focus, 5-minute short break, and 15-minute long break
- Monthly calendar with per-day task counts and task completion
- Habit tracker with check-ins and streaks
- Weekly completion chart, category distribution, and productivity score

PREFERENCES, BACKUPS & REMINDERS
- Light and dark themes; the preference is saved locally
- JSON backup export and validated backup import
- Recovery export that preserves an unreadable original localStorage value instead of silently overwriting it
- Browser notifications for tasks with a due time, after permission is granted
- Online/offline status indicator; the app and local data remain usable offline
- Responsive layouts for desktop, tablet, and mobile browsers
- Keyboard shortcuts: N opens quick add; / focuses task search; Escape closes dialogs or exits focus mode

HOW TO RUN
1. Extract the ZIP file.
2. Open index.html in a modern browser (Chrome, Edge, Firefox, or Safari).
3. Add tasks and start using Daylight. There is no install or build step.

DATA & PLATFORM NOTES
- Tasks, habits, theme preference, focus-session count, and daily goal are stored in
  the browser's localStorage under the existing key `daylight-todo-v1`.
- Existing Daylight data using that storage key is read and migrated in place when
  the app starts. Export a JSON backup before clearing browser data or changing devices.
- Importing a backup replaces the current task and habit data only after confirmation.
- Browser reminders are best-effort and run only while the app page is open. They need
  notification permission and a secure context (HTTPS or localhost). The app does not
  provide push notifications after the browser or page is closed.
- The app has no user accounts, cloud database, cross-device sync, team sharing, or
  external AI connection. Data remains on this device/browser unless exported.

PROJECT FILES
- index.html: application markup and base styles
- enhancements.css: visual refresh, responsive refinements, and new component styles
- app.js: application state, persistence, task logic, calendar, habits, timer, and events
- index-original.html: supplied original project snapshot retained for reference
