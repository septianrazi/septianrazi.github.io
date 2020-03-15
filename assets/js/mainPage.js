// ----------
// NAV SCROLL 
// ----------
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
}

// ----------
// TABS 
// ----------
function openCity(evt, cityName) {
    // Declare all variables
    var i, tabcontent, tablinks;
  
    // Get all elements with class="tabcontent" and hide them
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
      tabcontent[i].style.display = "none";
    }
  
    // Get all elements with class="tablinks" and remove the class "active"
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
      tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
  
    // Show the current tab, and add an "active" class to the button that opened the tab
    document.getElementById(cityName).style.display = "block";
    evt.currentTarget.className += " active";
  }

  document.getElementById("defaultOpen").click();

// ----------
// MASONRY 
// ----------
// external js: masonry.pkgd.js, imagesloaded.pkgd.js

// init Masonry
var grid = document.querySelector('.masonry');

var msnry = new Masonry( grid, {
  itemSelector: '.masonry-item',
  columnWidth: '.masonry-sizer',
  gutter: 20,
});

imagesLoaded( grid ).on( 'progress', function() {
  // layout Masonry after each image loads
  msnry.layout();
});

// -------------
// MODALS
// -------------
// Get the modal
var modals = document.querySelectorAll(".modal");

// Get the <span> element that closes the modal
var spans = document.getElementsByClassName("close");

function displayModal(thisModalID) {
  thisModal = document.getElementById(thisModalID)
  thisModal.style.display = "block";
}

// When the user clicks on <span> (x), close the modal
for (var i = 0; i < spans.length; i++) {
  spans[i].onclick = function() {
    for (var index in modals) {
      if (typeof modals[index].style !== 'undefined') modals[index].style.display = "none";    
    }
  }
}
 
// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
      for (var index in modals) {
      if (typeof modals[index].style !== 'undefined') modals[index].style.display = "none";    
      }
    }
}



