controller.on('frame',scattergestures);
controller.connect();
gesture_output.innerText = "Show thumb for details on scatterplot";
//

function scattergestures(frame) {

    if(!frame.valid) return;

    if(frame.hands.length == 2) {     //IMPLEMENT ZOOM
      if(frame.hands[0].type=='left') {
        left = frame.hands[0];
        right = frame.hands[1];
      } else {
        left = frame.hands[1];
        right = frame.hands[0];
      }
      leftnormal = left.palmNormal;
      rightnormal = right.palmNormal;
      leftvelocity = left.palmVelocity;
      rightvelocity = right.palmVelocity;
      normdotprod = 0.0;
      velocitysum = 0.0;
      for (i=0; i<3;i++) {
        normdotprod += leftnormal[i]*rightnormal[i];
        velocitysum += Math.abs(leftvelocity[i]) + Math.abs(rightvelocity[i]);
      }
      if(normdotprod<0 && velocitysum > 500) {
        if(leftvelocity[0]>0){
          gesture_output.innerText = "Zoom IN";
          console.log("Zoom in");
          zoom(1.25);
          
        } else {
          gesture_output.innerText = "Zoom OUT";
          console.log("Zoom out");
          zoom(0.8);
        }
      } else {
       // output.innerText = "NO zoom";
      }
    } else if(frame.gestures.length > 0) {
        frame.gestures.forEach(function(gesture){
          if (gesture.type == "swipe") {
            if(frame.hands.length>0 && frame.hands[0].palmVelocity[0]>0) {
              show_criteria_screen();
              controller.removeListener('frame',scattergestures);
              //screenwindow.innerText = "right swipe performed";
              //update screen to be shown
            } else {
              show_filter_screen();
              controller.removeListener('frame',scattergestures);
              //screenwindow.innerText = "left swipe performed";
            }
            //controller.removeListener('frame',scattergestures);
            console.log("Screen Change");
          }
        });
    } else {
      if (frame.hands.length == 1 && getExtendedFingers(frame.hands[0])==1 && frame.hands[0].fingers[0].extended) {
        //show_info();
        //controller.removeListener('frame',scattergestures);
      }      
    }
  }

  function isKeyTapGesture(gestures) {
    if(gestures.length > 0) {
        gestures.forEach(function(gesture){
          if (gesture.type == "keyTap") {
            console.log("keyTap Gesture");
            return true;
          }
        });
      }
      return false;
  }

 $('#myModal').on('hidden', function () {
    console.log("Modal hidden");
    controller.on("frame",scattergestures);
  })