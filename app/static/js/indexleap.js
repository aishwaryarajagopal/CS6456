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
          zoom();
          
        } else {
          gesture_output.innerText = "Zoom OUT";
          console.log("Zoom out");
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
      //show_info();
      //controller.removeListener('frame',scattergestures);

    // } else if (frame.pointables.length > 0 && getExtendedFingers(frame.hands[0]) == 1) {
    //   //canvasElement.width = canvasElement.width; //clear
    //   //Get a pointable and normalize the tip position
    //   var pointable = frame.pointables[0];
    //   var interactionBox = frame.interactionBox;
    //   var normalizedPosition = interactionBox.normalizePoint(pointable.stabilizedTipPosition, true);

    //   // Convert the normalized coordinates to span the canvas
    //   var canvasX = viz.width * normalizedPosition[0];
    //   var canvasY = viz.height * (1 - normalizedPosition[1]);
    //   //displayArea.strokeText("O",canvasX, canvasY);
    //   //output.innerText = document.elementFromPoint(canvasX, canvasY);
    //   var evt = new MouseEvent("click", { //can generate any mouse event instead of click
    //     view: window,
    //     cancelable: true,
    //   /* whatever properties you want to give it */
    //   });
    //   if (document.elementFromPoint(canvasX, canvasY) != null && isKeyTapGesture(frame.gestures)) {
    //     //dispatch mouse event to element under pointer x, y co-ordinates
    //     document.elementFromPoint(canvasX, canvasY).dispatchEvent(evt); 
    //   }
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