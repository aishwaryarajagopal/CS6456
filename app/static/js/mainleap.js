  document.getElementById("main_title").innerHTML = "Welcome to GestViz";
  document.getElementById("gesture_output").innerHTML = "Make a fist to bring up datasets";

  circle_x = [];
  var circle_y = 250;
  var evt = new MouseEvent("mouseover", { 
        cancelable: true,
      });

  // Set up the controller:
  controller.on('frame', processFrameForFist);
  controller.connect();

  function getFist(hand,index,hands) {
    progress.style.width = hand.grabStrength * 700 + 'px';
    if(hand.grabStrength.toPrecision(2) == 1.00) {
      controller.disconnect();
      controller.removeListener('frame', processFrameForFist);
      gesture_output.innerHTML = "Select dataset by a show of fingers"
      show_all_schema();
      //show_dataset();
    }
  }

  function show_all_schema() {
    $.ajax({
    contentType: 'application/json; charset=utf-8',
    url:'/data/retrieve_schema_list',
    dataType: 'json',
    success: function (results) {
      console.log(results);
      show_table(results);

    },
    error: function (request, status, error) {
        //alert(error);
      }
    });

  }

  function setdbid(dbid) {
    console.log("dbid", dbid);
    $.ajax({
    contentType: 'application/json; charset=utf-8',
    url:'/data/setdbid',
    dataType: 'text',
    data: "dbid="+dbid,
    success: function (results) {
      document.location.href = 'index1.html';
    },
    error: function (request, status, error) {
        console.log(error);
      }
    });
  }

  function getNumber(hand,index,hands) {
    //gesture_output.innerHTML = "checking finger number";
    var extendedFingerCount = hand.fingers.filter(
                function(finger, index, fingers) {return finger.extended}).length;
    switch (extendedFingerCount){
      case 1:
        console.log("select dataset 1");
        //set session variable
        break;
      case 2:
        console.log("select dataset 2");
        break;
      case 3:
        console.log("select dataset 3");
        break;
      case 4:
        console.log("select dataset 4");
        break;
      case 5:
        console.log("select dataset 5");
        break;
    }
    if(extendedFingerCount>0) {
      setdbid(extendedFingerCount);
      controller.removeListener('frame',processFrameForNumber);
      //if (document.elementFromPoint(circle_x[, canvasY) != null && isKeyTapGesture(frame.gestures)) {
      //  document.elementFromPoint(circle_x[extendedFingerCount], circle_y).dispatchEvent(evt); 
      //}
      //gesture_output.innerHTML = "Selected dataset " + extendedFingerCount;
      //var url = "sessionajax.aspx?function=setdbid&dbid=" + extendedFingerCount + "";
      //show_dataset();
    }
  }

  function show_table(results) {
    //show_dataset
    var svg = d3.select("body")
          .append("svg")
          .attr("width", screen.availWidth)
          .attr("height", 500);

    var nodes = svg.append("g")
                .selectAll("circle")
                .data(results)
                .enter()
                .append("g")
                .attr("transform", function (d,i) {
                      circle_x[i] = i*200+300;
                      return "translate(" + circle_x[i] + "," +circle_y +")";
                    })
                .on("mouseover", function(d) { d3.select(this).select("circle").style("fill","#addd8e"); })
                .on("mouseout", function(d) { d3.select(this).select("circle").style("fill","#238b43"); });

    nodes.append("circle")
          .attr("r","80")
          .attr("fill", "#238b43");
    nodes.append("text")
          .attr("text-anchor", "middle")
          .attr("font-size","30px")
          .attr("fill","#e0f3db")
          .attr("dy","10")
          .text(function (d,i) { return d[1]; });

    controller.on('frame', processFrameForNumber);
    controller.connect();
  }