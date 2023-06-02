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
const now = new Date();
const currentHour = now.getHours();


    setInterval(() => {

if (currentHour >= 9 && currentHour < 20) {

    let img = document.getElementsByTagName("yt-image");

for (let i = 0; i< img.length; i++) {
    try{
    img[i].getElementsByTagName("img")[0].src ="https://dummyimage.com/720x404/000/fff&text=work";
    }catch(e) {}
}
} else {
}

    }, 1000);
})();