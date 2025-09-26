// Global configuration for the script
const DEFAULT_START_ADRESS = 'Düppelstraße 1, 52068 Aachen'; // Default adress for event starting points
const DAYS_TO_CHECK_IN_FUTURE = 14; // Number of days ahead to fetch calendar events
const HOURS_TO_RESET = 6; // Time threshold in hours to reset the start adress to default
const TRAVEL_IDENTIFIER_STRING = 'Anreise ';


// Function to add travel time blocks to your calendar based on events
function addTravelTimeBlockers() {
  let calendarId = 'primary';
  let today = new Date();
  today.setHours(0);
  today.setMinutes(1);
  let futureDate = new Date(today.getTime() + DAYS_TO_CHECK_IN_FUTURE * 24 * 60 * 60 * 1000);

  let events = CalendarApp.getCalendarById(calendarId).getEvents(today, futureDate);
  events.sort((a, b) => a.getStartTime() - b.getStartTime());

  events.forEach((event, index) => {

    const prevEvent = events[index-1];

    //#region Skip Events that are back to back to previous events. This skipps all Traveltimes
    if (prevEvent && prevEvent.getEndTime().getTime() === event.getStartTime().getTime()) {
      console.log("Skipping Event: " + event.getTitle() + " because its back to back to prev Event");
      return; // Skip this iteration
    }
    //#endregion
    //#region Skip Events that are Online or Travel
    if (!event.getLocation() || isDigitalLocation(event.getLocation()) || event.getTitle().includes(TRAVEL_IDENTIFIER_STRING)) {
      if(isDigitalLocation(event.getLocation())){
        console.log("Skipping " + event.getTitle() + " because its digital");
      }
      return;
    }
    //#endregion
    //#region Set Adress to events that are Next Back to Back
    if(!event.getTitle().includes(TRAVEL_IDENTIFIER_STRING) && !event.getLocation()){  //if its not a Travel event nor has a Location.
      //TODO make recursive
      if(
          !event.getLocation()
          && events[index+1]  //Element exists
          && !events[index+1].getTitle().includes(TRAVEL_IDENTIFIER_STRING) //isn't a Travel
          && event.getStartTime().getTime() === events[index+1].getEndTime().getTime() //Times are back to back
          && events[index+1].getLocation() //previous Event has Location
      ){
        event.setLocation(events[index+1].getLocation());
      }
    }
    //#endregion
    //#region Set Start Adress for Journey
    let startAdress = DEFAULT_START_ADRESS;
    if(prevEvent && (event.getStartTime().getTime() - prevEvent.getEndTime().getTime()) / 3600000 <= HOURS_TO_RESET){
      startAdress = prevEvent.getLocation();
    }
    //#endregion

    const travelEventTitle = TRAVEL_IDENTIFIER_STRING + event.getTitle();
    let startTime = new Date();
    let endTime = new Date();

    let travelDetails = getTravelTime(startAdress, event.getLocation());
    if (travelDetails) {
      startTime = new Date(event.getStartTime().getTime() - travelDetails.duration * 1000);
      endTime = event.getStartTime();

      if (!prevEvent || startTime >= prevEvent.getEndTime()) {
        let notes = `From: ${startAdress} \nTo: ${event.getLocation()} \n${travelDetails.mode}`;
        let newEvent = CalendarApp.getCalendarById(calendarId).createEvent(travelEventTitle, startTime, endTime, {description: notes});
        newEvent.setColor("1");
        newEvent.removeAllReminders();
        newEvent.addPopupReminder(10);
      }
    }
  });
}


// Function to get travel time and mode based on origin and destination adresses
function getTravelTime(origin, destination) {
  if (!origin || origin.trim() === '') {
    console.log("Invalid origin. Using default adress.");
    origin = DEFAULT_START_ADRESS;
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
