controller.on('frame',filtergestures);
controller.connect();

function filtergestures(frame) {
  if(frame.valid) {
    if(frame.hands.length == 2) {     //IMPLEMENT FILTER reduce/increase
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
          console.log("Filter in");
          bar_filter(1);  
        } else {
          console.log("Filter out");
          bar_filter(-1);
        }
      }
    } else if (frame.gestures.length > 0) {
      frame.gestures.forEach(function(gesture){
        if (gesture.type == "circle") {
          rotate_wheel();
        } else if (gesture.type == "swipe") {
          document.location.href = 'index1.html';
          controller.removeListener('frame',filtergestures);
          console.log("Screen Change");
        }
      });    
    }
  }
}