////////////////////////////////////////////////////////////////////////////////
// Authored by Septian Razi
// Code resused from ANU COMP1720 Major Assignment Submission 2017
////////////////////////////////////////////////////////////////////////////////

// arrays used to store the image splices
var image1Splice = [];
var imageSplicesList = []; // two dimentional array used to store all image splices array above

var currentImageSplice = []; // array used to store the current image splices
var imageList = []; // Array used to store all the images

var spliceAmount = 60; //WARNING INcreasing can severely decrease performance - increase this to increase glitch thinness
var thinness;
var flickerPeriod = 2500; // increase this to increase the gap between intermittent flickeress
var glitchStage = 1; // glitch stage indicates the level of glitchiness a user is in

var currentImageStep = 0; // index marker for what image the user is currently on
var lastImageStep = 2;
var flicker = false;
var turnOnOpacity = 255;
var framesInTurnOn = 0;
var glitchForever = false;
var heavyGlitch = false;
var glitchLength = 50; // boolean to determine how far the horizantel splices move to simulate glitching
var glitchAmount = []
var switchCount = 0;
var randomSwitchCounter = [];
var inDeGlitch = false; // boolean to determin if in deglitching transition
var xVal = 0; // value to determine glitch level (increased with user Input)
var inChangeImage = false; // boolean to determine if in change image transition
var glitchImageNow = 0;

var shutdownTransitionNow;
var shutdownY = 1;
var inShutdownTransition = false;
var shutdownX = 1;
var inTurnOnTransition = false;
var stareBlank = true;

var lastPressed;

function preload() {

  var image1 = loadImage("images/under_construction_logo_dark.png");

  imageList = [image1];
}


function setup() {

  createCanvas(windowWidth, windowHeight);
  background(0);


  thinness = height/spliceAmount;

  console.log("entering critical loop (most computers might stall here)")

  for ( i = 0; i < spliceAmount; i++) {
    image1Splice.push(imageList[0].get(0,0+thinness*i,width,thinness+thinness*i));

  }

    console.log ("finished loop, now pushing")

  imageSplicesList.push(image1Splice);

  currentImageSplice = imageSplicesList[currentImageStep].slice();//imageSplicesList[0];
  currentImage = imageList[currentImageStep];
  lastImageStep = imageList.length-1;

  for ( i = 0; i < currentImageSplice.length; i++){
    randomSwitchCounter[i] = i;
  }
  console.log("finsihed setup");
}

function draw() {
    translate((width/2) - imageList[currentImageStep].width/2, (height/2)-imageList[currentImageStep].height/2)
    // turn on transition scene
      if (millis() % flickerPeriod >100 && millis() % flickerPeriod <randomGaussian(400,200)){
        flicker = true;
      } else{
        flicker = false;
      }

      image(currentImage,0,0);
      if (glitchImageNow + 5 > frameCount || glitchForever || frameCount % 2 == 1 && flicker ){
        glitch();
      }

      // keep on decreasing xVal so users must continue pressing keys to progress
      if (xVal > 1){
        xVal--;
      }

      if (!inChangeImage && !inDeGlitch){
        checkGlitchStage();
      }


    // fill(255);
    // text(frameRate(),49,height-40)
}


// function called when we need to return all variables to its initial state
function returnInitial(){
   glitchForever = false;
   heavyGlitch = false;inChangeImage
   glitchLength = 50;
   glitchAmount = []
   switchCount = 0;
   flickerPeriod = 2500;
   inChangeImage = false;
   inDeGlitch = false;
   xVal = 0;

   for ( i = 0; i < currentImageSplice.length; i++){
     randomSwitchCounter[i] = i;
   }
}

// function to check glitch stage and progress to a heavier glitch stage
function checkGlitchStage(){
  if (xVal < 50){
    glitchStage = 1;
  } else if (xVal < 500){
    glitchStage = 2;
  } else if (xVal < 1000){
    glitchStage = 3;
  } else if (xVal < 1500){
    glitchStage = 4;
  } else if (xVal < 2000){
    glitchStage = 5;
  }
}

// fucntion called when an image needs to glitch
function glitch(){
  var x = 0;
  var k;

// for every splice in the image, introduce some variation in it's x position to
// simulate glitchiness
  for (var i = 0; i < image1Splice.length; i++) {
    k = random([0,1,2,3,4]);

    if (glitchStage == 1) {

      glitchAmount = [k]
      glitchLength = 50;
      heavyGlitch = false;
      flickerPeriod = 2500;

    } else if (glitchStage == 2){

      glitchAmount = [(k-1)% 5,k]
      glitchLength = 70;1000
      heavyGlitch = false;
      flickerPeriod = 2000;

    } else if (glitchStage == 3){
      glitchAmount = [(k-1)% 5,k,(k+1)% 5];
      glitchLength = 90;
      flickerPeriod = 1500;
      heavyGlitch = false;

    } else if (glitchStage == 4) {
      glitchAmount = [(k-1)% 5,(k-2)% 5,(k+1)% 5,k,]
      glitchLength = 110;
      flickerPeriod = 1000;
      heavyGlitch = false;

    } else {
      heavyGlitch = true;
      flickerPeriod = 500;
      glitchLength = 130;
      glitchForever = true;
    }

    if (contains(i%5,glitchAmount) || heavyGlitch){
      x = randomGaussian(0,glitchLength);
      image(currentImageSplice[i],x,0+thinness*i);
    }
  }
}

// function to determine if an element is within an array, used in glitch()
function contains (k, array){
  for (var i = 0; i < array.length; i++) {
    if (array[i] == k){
      return true;
    }
  }
  return false;
}

// function called when a key is pressed
function keyTyped() {
  if (!inDeGlitch && !inChangeImage && !inShutdownTransition && !inTurnOnTransition) {
    xVal += 7;
    glitchImageNow = frameCount;
    if (key === '+' || key === '-'){
      xVal += 200;
      glitch();
    }
  }
}

////////////////////////////////////////////////////////////////////////////////
// Septian Razi
////////////////////////////////////////////////////////////////////////////////
