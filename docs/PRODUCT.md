# Product

## Purpose

Week Planner is a personal time allocation application for designing an intentional, repeating week.

Every week contains exactly 168 hours. The product helps a user decide how those hours should be allocated across the things that matter, before the week is filled by default.

The product is about allocation rather than productivity optimisation.

## Product promise

Week Planner should make the intended balance of a week understandable at a glance.

A user should be able to answer questions such as:

- How much time am I allocating to work, sleep, family, exercise or other priorities?
- Is the plan realistic within the fixed total of 168 hours?
- Where is there genuinely unallocated time?
- How would a different type of week compare?

## Product boundaries

Week Planner is not intended to become:

- a calendar
- an appointment scheduler
- a task manager
- a project management system
- a reminder application
- a habit streak application
- an employee monitoring tool

Calendar events, tasks and actual time tracking may be considered only where they clearly support the central act of intentional weekly allocation. They must not displace that purpose.

## Core product principles

### The week is finite

The fixed 168-hour total is a defining constraint, not an inconvenience.

Allocating more time to one activity necessarily leaves less time for another. The product should make that trade-off visible without judgement.

### Visual first

A weekly plan should communicate its shape at a glance.

Detailed numbers are useful, but they support the visual plan rather than replacing it.

### Direct manipulation

Creating a plan should feel closer to painting than completing a form.

Common allocation actions should be quick, spatial and reversible.

### Calm rather than pressurising

The product should help a user think deliberately.

It should not create anxiety through overdue states, streaks, warnings, productivity scores or unnecessary notifications.

### Low friction

The software should minimise administration.

Common actions should require few steps, and the interface should remain predictable.

### Local-first and user-controlled

The product should work without requiring an account or cloud service.

The user should be able to export their data in a portable form.

Future synchronisation should enhance the product rather than become a dependency for basic use.

### Stability

A weekly plan can contain substantial effort and personal value.

Preserving existing plans and providing safe migrations are product requirements, not merely technical concerns.

### Native quality on each platform

The web application should remain a good web application.

A future iOS application should be genuinely native and should use appropriate Apple interaction patterns rather than reproduce desktop web behaviour mechanically.

## Current confirmed functionality

The present web application allows a user to:

### Manage plans

- create a new plan
- select between multiple saved plans
- rename a plan
- duplicate a plan
- delete a plan while retaining at least one plan

A new plan begins with default activities for Work, Family, Sleep and Admin.

### Manage activities

- add an activity
- select an activity for painting
- rename an activity
- choose from preset colours
- choose a custom colour
- choose an icon
- reorder activities by dragging
- clear an activity from every allocated cell
- delete an activity and remove its allocations

### Allocate the week

- view Monday to Sunday
- allocate every day in five-minute units
- paint an activity onto time cells
- erase allocated time
- drag across cells when using a mouse
- use right-click as an immediate erase action
- view the grid in 5-minute, 15-minute or 1-hour groups

When a grouped 15-minute or 1-hour block contains mixed underlying allocations, the interface represents the mixture proportionally.

Painting a grouped block overwrites all five-minute cells within that displayed block.

### Understand totals

- see total allocated time for each activity
- see total free time across the week

The sum of allocated and free time always represents the full 168-hour week when application data is valid.

### Store and move data

- save plans automatically in the current browser
- undo and redo recent edits within the current session
- download all plans as a JSON backup file and import a backup file
- remember the selected time scale on this device
- export all plans as JSON
- import a valid version 3 JSON set of plans
- reject invalid imports without replacing current plans
- restore the previous plans after a successful import when the pre-import backup is available
- recover from unusable browser-stored data by saving the original text, importing a valid replacement or explicitly resetting

## Current experience

The existing design is dark and visually structured, with a weekly grid and an activity sidebar that becomes a drawer on smaller screens. It supports mouse, touch and keyboard editing. The hourly overview offers a starting point, with five-minute precision available when needed. Mobile comfort still benefits from real-device review.

## User-experience direction

Future work should aim for:

- clear hierarchy
- comfortable touch targets
- full keyboard operability where practical
- screen-reader labels and meaningful focus states
- responsive behaviour across supported screen sizes
- safe undo or recovery for destructive changes
- efficient editing without excessive modal dialogs
- obvious feedback when data is saved, imported or changed

The product should retain precision without requiring the entire 24-hour by seven-day grid to fit on one small screen.

## Product decision test

Before adding a feature, ask:

1. Does it help a user allocate a finite week intentionally?
2. Does it strengthen the visual understanding of priorities?
3. Can it remain calm and low-friction?
4. Does it preserve user control of data?
5. Could the same benefit be achieved more simply?
6. Would it pull the product towards a generic calendar or task manager?

A feature that fails these tests should normally be rejected, reduced or discussed further.

## Longer-term direction

The following are directions for exploration, not committed requirements:

- a native SwiftUI iPhone application
- iPad support
- widgets showing the intended shape of the day or week
- Siri Shortcuts for opening or switching plans
- optional iCloud synchronisation
- optional comparison of planned and actual time
- reflection and review tools
- plan templates for different types of week
- Apple Watch support where a clearly useful interaction is identified

The immediate priority is to strengthen and clarify the web application before beginning a native rebuild.

## Measures of success

Success should not be measured primarily by feature count.

Useful indicators include:

- a user can create a meaningful plan quickly
- the weekly balance is clear without explanation
- existing data survives application updates
- the interface is dependable and reversible
- the product remains distinct from calendars and task managers
- the codebase can evolve without repeatedly breaking established behaviour

## Approved narrow-screen planner model

On 17 July 2026 the first responsive mobile and narrow-screen planner slice was approved and implemented.

The planner shows a consecutive day window based on the measured width available for day columns. It shows at least three days, expands through four, five and six days when space permits, and shows the complete seven-day week when all days fit. Previous and Next controls move partial-week windows by one day, are displayed whenever fewer than seven days are visible regardless of the activities-layout breakpoint, and are disabled at the Monday and Sunday boundaries.

The grid keeps the time column visible beside the day columns and is intended to support viewports down to 375 CSS pixels without horizontal page scrolling. At and above 1280 CSS pixels, the established permanent activities sidebar remains visible.

On narrow screens the activities sidebar becomes an overlay drawer opened from an Activities button. The drawer overlays the planner so the grid width is not reduced. While the drawer is closed, the selected activity and Paint or Erase tool remain visible in a compact toolbar.

Touch editing is deliberately tap-based for this slice. A deliberate touch or pen tap on a displayed block paints or erases that whole displayed block, including the existing grouped 15-minute and 1-hour behaviour. Vertical swiping is reserved for normal grid scrolling and must not paint cells. Mouse dragging remains a per-interaction behaviour: editing continues only while the relevant mouse button is physically held, and right-button dragging erases.

## Approved release-candidate experience, 6 September 2026

The project lead approved completion of the review recommendations, with mobile usability as an explicit priority.

A new installation starts with the hourly overview. The selected scale is remembered separately from plan data. Five-minute precision remains available. A time jump control and visible scrollbars help users reach any part of the day.

The three-to-seven-day model and tap-to-edit, swipe-to-scroll distinction remain. Touch cells are at least 44 CSS pixels tall, including fine resolution. Selecting an activity closes the mobile drawer. Activity editors offer Move up and Move down controls in addition to dragging.

Undo and redo reverse recent plan and activity changes. A mouse paint gesture is one undo operation. History contains up to 50 changes and lasts until reload or a successful import, restore or reset. Existing pre-import backup recovery remains available separately.

The weekly grid supports keyboard navigation, painting and erasing. Cells expose time and activity labels, including mixed allocations. Plan and backup dialogs contain focus and return it when closed.

Plan options contains creation, renaming, duplication, deletion and distinct Export backup and Import backup actions. Backup files provide the primary portable-data workflow; JSON copy and paste remain available. Feedback must report actual copy failures and warn when saving fails.

Version 1.0 is ready when users can create a meaningful week, edit it comfortably on agreed devices, reverse mistakes, preserve and restore their plans, and receive updates without losing data. Real-device verification remains necessary alongside browser automation.
