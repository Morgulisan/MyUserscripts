// ==UserScript==
// @name         Less Youtube
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Makes Youtube less interesting in working hours.
// @author       You
// @match        https://www.youtube.com/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const UID_TabID = makeid(16);

    const MAX_HOURS = 8;  // Maximum hours to keep in records
    const URL = window.location.href;
    const now = new Date().getTime();

    // Check local storage for existing entry
    let data = JSON.parse(localStorage.getItem('tabOpenTimeTracker')) || {};

    // Create new entry if it doesn't exist or update start time
    if (!data[UID_TabID] || (now - data[UID_TabID].start) > MAX_HOURS * 60 * 60 * 1000) {
        data[UID_TabID] = {
            start: now,
            end: null
        };
    }

    // Update local storage
    localStorage.setItem('tabOpenTimeTracker', JSON.stringify(data));

    // On tab close or refresh, record end time
    window.addEventListener('beforeunload', function() {
        let data = JSON.parse(localStorage.getItem('tabOpenTimeTracker'));
        if (data[UID_TabID]) {
            data[UID_TabID].end = new Date().getTime();
            localStorage.setItem('tabOpenTimeTracker', JSON.stringify(data));
        }
    });

    // Clean up old records every hour
    setInterval(function() {
        let data = JSON.parse(localStorage.getItem('tabOpenTimeTracker'));
        const now = new Date().getTime();

        for (let url in data) {
            if ((now - data[url].start) > MAX_HOURS * 60 * 60 * 1000) {
                delete data[url];
            }
        }

        localStorage.setItem('tabOpenTimeTracker', JSON.stringify(data));
    }, 6 * 60 * 1000);  // Runs every 10 min

    function calculateTotalTimeSpent() {
        let data = JSON.parse(localStorage.getItem('tabOpenTimeTracker')) || {};
        let total = 0;
        const now = new Date().getTime();
        for (let url in data) {
            let entry = data[url];
            let start = entry.start;
            let end = entry.end || now;  // if end is not set, use current time
            let timeSpent = end - start;

            // Only count time spent in the last 8 hours
            if ((now - start) <= MAX_HOURS * 60 * 60 * 1000) {
                total += timeSpent;
            }
        }
        return total;  // return total time spent in milliseconds
    }

    const time = new Date();
    const currentHour = time.getHours();


    setInterval(() => {

        if (window.location.href === "https://www.youtube.com/" && (currentHour >= 9 && currentHour < 20) || calculateTotalTimeSpent() > 1800000 ) {

            let img = document.getElementsByTagName("yt-image");

            for (let i = 0; i < img.length; i++) {
                try {
                    img[i].getElementsByTagName("img")[0].src = "https://dummyimage.com/720x404/000/fff&text=work";
                } catch (e) {
                }
            }
            let blurValue = Math.max(calculateTotalTimeSpent() - 900000, 0)/1800000
            for (let j = 0; j < document.querySelectorAll("#video-title").length; j++) {
                document.querySelectorAll("#video-title")[j].style.filter = "blur(" + blurValue + "px)";

            }
            let pageBlurValue = Math.max(calculateTotalTimeSpent() - 2700000, 0)/1800000
            document.querySelectorAll("body")[0].style.filter = "blur(" + pageBlurValue + "px)";
        } else {
        }

    }, 1000); //Redraw website every second


    function makeid(length) {
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charactersLength = characters.length;
        let counter = 0;
        while (counter < length) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
            counter += 1;
        }
        return result;
    }

})();