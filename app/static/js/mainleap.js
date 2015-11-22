  document.getElementById("main_title").innerHTML = "Welcome to GestViz";
  document.getElementById("gesture_output").innerHTML = "Make a fist to get started";

  var circle_x = [];
  var circle_y = 250;
  var hand_y   = 50;

  // Set up the controller:
  controller.on('frame', processFrameForFist);
  controller.connect();

  function getFist(hand,index,hands) {
    progress.style.width = hand.grabStrength * 700 + 'px';
    if(hand.grabStrength.toPrecision(2) == 1.00) {
      controller.disconnect();
      controller.removeListener('frame', processFrameForFist);
      gesture_output.innerHTML = "Select dataset"
      show_all_schema();
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
    var extendedFingerCount = hand.fingers.filter(
                function(finger, index, fingers) {return finger.extended}).length;
    if(extendedFingerCount>0) {
      d3.select(document.getElementById(extendedFingerCount)).style("fill","#addd8e");
      setTimeout( function() { 
        setdbid(extendedFingerCount);      
      }, 2000);
      controller.removeListener('frame',processFrameForNumber);
    }
  }

  function show_table(results) {
    //show_dataset

    var imgdata = [1,2,3,4,5];

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
                    });

    nodes.append("image")
         .attr("xlink:href", function(d,i) { return "/static/pics/"+(i+1)+".png";})
         .attr("transform", "translate(-45,-170)")
          .attr("width", "85")
          .attr("height", "100");
    nodes.append("circle")
          .attr("r","80")
          .attr("fill", "#238b43")
          .attr("id",function(d,i) {return i+1;});
    nodes.append("text")
          .attr("text-anchor", "middle")
          .attr("font-size","30px")
          .attr("fill","#e0f3db")
          .attr("dy","10")
          .text(function (d,i) { return d[1]; });

    controller.on('frame', processFrameForNumber);
    controller.connect();
  }