// Global configuration for the script
const DEFAULT_START_ADDRESS = 'Düppelstraße 1, 52068 Aachen'; // Default address for event starting points
const DAYS_TO_CHECK_IN_FUTURE = 14; // Number of days ahead to fetch calendar events
const HOURS_TO_RESET = 4; // Time threshold in hours to reset the start address to default
const TRAVEL_IDENTIFIER_STRING = 'Anreise ';


// Function to add travel time blocks to your calendar based on events
function addTravelTimeBlockers() {
  let calendarId = 'primary'; // Identifier for the target calendar
  let today = new Date();
  today.setHours(0);
  today.setMinutes(1);
  let futureDate = new Date(today.getTime() + DAYS_TO_CHECK_IN_FUTURE * 24 * 60 * 60 * 1000); // Date after the specified number of days

  // Fetching events between today and the future date
  let events = CalendarApp.getCalendarById(calendarId).getEvents(today, futureDate);
  events.sort(function(a, b) { return a.getStartTime() - b.getStartTime(); }); // Sort events by start time for sequential processing

  let lastEventEnd = null; // Track end time of the last event
  let lastEventLocation = DEFAULT_START_ADDRESS; // Track location of the last event, start with default

  events.forEach(function(event, index) {
    let nextEvent = events[index + 1]; // Get the next event in the list
    if (!event.getLocation() && nextEvent && event.getEndTime().getTime() === nextEvent.getStartTime().getTime() &&
        !isDigitalLocation(nextEvent.getLocation()) && !event.getTitle().includes(TRAVEL_IDENTIFIER_STRING)) {
      // Set the location of the current event to the location of the next event
      event.setLocation(nextEvent.getLocation());
    }

    if(!event.getLocation() || isDigitalLocation(event.getLocation()) || event.getTitle().includes(TRAVEL_IDENTIFIER_STRING)){
      return;
    }
    let startAddress = lastEventLocation;
    let eventStartTime = event.getStartTime();

    // Check if the previous event's location should be used as the starting point
    if (lastEventEnd && (eventStartTime - lastEventEnd) / 3600000 <= HOURS_TO_RESET) {
      startAddress = lastEventLocation !== DEFAULT_START_ADDRESS ? lastEventLocation : startAddress;
    } else {
      startAddress = DEFAULT_START_ADDRESS; // Reset to default if the gap is larger than HOURS_TO_RESET
    }

    // Check for existing travel events before creating new ones
    let travelEventTitle = TRAVEL_IDENTIFIER_STRING + event.getTitle();
    let startTime = new Date(eventStartTime - (60000 * 60)); // Temporarily assume 1 hour for travel
    let endTime = eventStartTime;

    let existingTravelEvents = CalendarApp.getCalendarById(calendarId).getEvents(startTime, endTime, {search: travelEventTitle});
    if (existingTravelEvents.length > 0) {
      console.log("Travel time already calculated and blocked for this event, skipping recalculation.");
      return; // Skip recalculation if a travel event already exists
    }

    // Proceed with travel time calculation
    let travelDetails = getTravelTime(startAddress, event.getLocation());
    if (travelDetails) {
      startTime = new Date(eventStartTime - travelDetails.duration * 1000);
      endTime = eventStartTime;

      if (!lastEventEnd || startTime >= lastEventEnd) {
        let notes = `From: ${startAddress} \n To: ${event.getLocation()} \n ${travelDetails.mode}`;
        let newEvent = CalendarApp.getCalendarById(calendarId).createEvent(travelEventTitle, startTime, endTime, {description: notes});
        newEvent.setColor("1");

        // Clear all existing reminders
        newEvent.removeAllReminders();

        // Set a new reminder for 10 minutes before the event
        newEvent.addPopupReminder(10); // 10 minutes before the event
      }
    }

    lastEventEnd = event.getEndTime(); // Update for the next iteration
    lastEventLocation = event.getLocation() || lastEventLocation; // Update location if available
  });
}

// Function to get travel time and mode based on origin and destination addresses
function getTravelTime(origin, destination) {
  if (!origin || origin.trim() === '') {
    console.log("Invalid origin. Using default address.");
    origin = DEFAULT_START_ADDRESS;
  }
  console.log("Calculating travel from " + origin + " to " + destination); // Logging for debugging

  let drivingDirections = Maps.newDirectionFinder().setOrigin(origin).setDestination(destination).setMode(Maps.DirectionFinder.Mode.DRIVING).getDirections();
  let walkingDirections = Maps.newDirectionFinder().setOrigin(origin).setDestination(destination).setMode(Maps.DirectionFinder.Mode.WALKING).getDirections();

  if (drivingDirections.routes.length && walkingDirections.routes.length) {
    let drivingDuration = drivingDirections.routes[0].legs[0].duration.value * 1.1 + 600; // Buffer added to driving time
    let walkingDuration = walkingDirections.routes[0].legs[0].duration.value * 1.1 + 120; // Buffer added to walking time

    if (walkingDuration <= 2100) { // Favor walking if under 30 minutes (2100 -120) /1.1 = 1800
      return {mode: "walking", duration: walkingDuration};
    } else {
      return {mode: "driving", duration: drivingDuration};
    }
  }
  return null; // Return null if no valid routes found
}

// Utility function to check if a location is digital (not physical)
function isDigitalLocation(location) {
  const digitalKeywords = [
    "Zoom", "Digital", "Microsoft Teams", "digital", "webex", "Webex", "Jitsi",
    "Webinar", "Videokonferenz", "skype", "Skype", "Google Meet", "Virtuelles Treffen",
    "Telekonferenz", "online", "Microsoft Teams Meeting", "telefonisch", "https:", "http:","zoom"
  ];
  return digitalKeywords.some(keyword => location.includes(keyword));
}
