var options = {frameEventName: 'animationFrame', background: false, loopWhileDisconnected: false, enableGestures : true};
var controller = new Leap.Controller(options);

controller.on('connect', onConnect);
function onConnect()
{
  console.log("Controller connected!");
}

controller.on('disconnect', onDisconnect);
function onDisconnect()
{
  console.log("Controller disconnected!");
}

controller.on('blur', onBlur);
function onBlur()
{
  console.log("Blur event - Browser Tab switched");
}

function processFrameForFist(frame) {
  if (frame.valid & frame.hands.length >0) {
    frame.hands.forEach(getFist);
  }
}

function processFrameForNumber(frame) {
  if (frame.valid & frame.hands.length >0) {
    frame.hands.forEach(getNumber);
  }
}

function getExtendedFingers(hand) {
    var extendedFingerCount = hand.fingers.filter(
                  function(finger, index, fingers){return finger.extended}).length;
    return extendedFingerCount;
}

function isScreenTapGesture(gestures) {
    if(gestures.length > 0) {
        gestures.forEach(function(gesture){
          if (gesture.type == "screenTap") {
            console.log("screenTap Gesture");
            return true;
          }
        });
      }
      return false;
  }

// function processFrameForSwipe(frame) {
//   if (frame.valid && frame.gestures.length > 0) {
//     frame.gestures.forEach(closeBox);
//   }
// }