// SOURCE: https://www.w3schools.com/howto/howto_js_sticky_navHeader.asp

// When the user scrolls the page, execute stickyNavBar
window.onscroll = function() {stickyNavBar()};

let f = 1;
// Get the navHeader
navHeader = document.getElementById('myHeader');

// Get the offset position of the navbar
let sticky = navHeader.offsetTop;

// Add the sticky class to the navHeader when you reach its scroll position. Remove "sticky" when you leave the scroll position
function stickyNavBar() {
    if (window.pageYOffset > sticky) {
        navHeader.classList.add("sticky");
    } else {
        navHeader.classList.remove("sticky");
    }

    console.log("executed");
}

console.log("yeet");
