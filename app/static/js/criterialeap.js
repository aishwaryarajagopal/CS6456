controller.on('gesture',clustergestures);
controller.connect();

function clustergestures(gesture) {
  if (gesture.type == "swipe") {
    document.location.href = 'index1.html';
    controller.removeListener('gesture',clustergestures);
    console.log("Screen Changed");
  }
} 