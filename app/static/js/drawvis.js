function myFunction(){
  gesture_output.innerHTML = "Make a fist to bring up datasets";
  draw_plot();
};

function getFist(hand,index,hands) {
  gesture_output.innerHTML = hand.grabStrength.toPrecision(2);
  if(hand.grabStrength.toPrecision(2) == 1.00) {
    gesture_output.innerHTML = "Fist";
    show_schema();
    controller.on('gesture', closeBox);
  }
}
function closeBox(gesture) {
  console.log(gesture.type);
  $('#myModal').modal('hide');
  //controller.disconnect();
}
function draw_plot(){
  $.ajax({
      contentType: 'application/json; charset=utf-8',
      url:'/data/get_scatterplot_points',
      dataType: 'text',
      success: function (results) {
        // ---
        // Handle dragging from HTML to dropping on SVG
        // ---
        var DragDropManager = {
          dragged: null,
          droppable: null,
          draggedMatchesTarget: function() {
            if (!this.droppable) return false;
            return true;//(dwarfSet[this.droppable].indexOf(this.dragged) >= 0);
          }
        }

        var results1 = JSON.parse(results);
        
        var cluster = new Array();
        var recs_array = new Array();
        for (var i = 0; i < results1.length; i++){
          cluster.push(results1[i]["cluster"]);
          recs_array.push.apply(recs_array, results1[i]["recs"])
        }
        
        var max = Math.max(...recs_array);
        var min = Math.min(...recs_array);

        var x = d3.scale.linear().range([0, 250]).domain([min, max]);
        var y = d3.scale.linear().range([0, 250]).domain([min, max]);

        var svg1 = d3.select("#viz")
              .append("svg")
              .attr("width", 900)
              .attr("height", 600)
              .attr("class","gestvizsvg")
              .call(d3.behavior.zoom().y(y).on("zoom", zoom)).on("mousedown.zoom", null).on("mousemove.zoom", null).on("touchstart.zoom", null).on("wheel.zoom", null).on("mousewheel.zoom", null);

        //Width and height
        var w = 900/results1.length;
        var h = 250;

        var color_x = d3.scale.category10();
        var color = d3.scale.ordinal().domain([0,1,2,3,4,5,6,7,8,9]).range(color_x.range()); 
        
        var g_x = -w;
        var g_y = 0;
        
        var selectedElement = 0;
        var currentX = 0;
        var currentY = 0;
        var currentMatrix = 0;
        
        for (var i = 0; i < results1.length; i++){
          var cl = results1[i]["cluster"];
          var recs = results1[i]["recs"];

          var cur_x = 10;
          var g = d3.select(".gestvizsvg")
              .append("g")
              .attr("width", w)
              .attr("height", h)
              .attr("class", "cluster")
              .on('mouseover',function(d){
                console.log(this);
                DragDropManager.droppable = cl; 
              })
              .on('mouseout',function(d){
                DragDropManager.droppable = null;
              })
              .attr('transform', function() {
                g_x = g_x + w
                if (i%2 == 1){
                  g_y = 250;
                }
                else{
                  g_y =  0;
                }
                return 'translate(' + g_x + ',' + g_y + ')';
              });
          
          g.selectAll("circle")
             .data(recs)
             .enter()
             .append("circle")
             .attr("class","draggable")
             .attr("cx", function(d) {
                if (cur_x > w-20){
                    cur_x = 10;
                }
                else cur_x = cur_x+20;
                return cur_x;
             })
             .attr("cy", function(d) {
                return y(d);
             })
             .attr("r", 5)
             .style("fill", color(i));
        }
        svg1.selectAll('.scale').remove();
        console.log(results1[0]);
        var cc = svg1.append("text")
                     .attr("x", 400)
                     .attr("y", 520)
                     .attr('class', 'scale')
                     .style('fill', "black")
                     .attr("font-size", "30px")
                     .text(function(d) { return results1[0]["field_name"]; });

        var legendRectSize = 18;
        var legendSpacing = 4;
        var legend = svg1.selectAll('.legend')
                          .data(cluster)
                          .enter()
                          .append('g')
                          .attr('class', 'legend')
                          .attr('transform', function(d, i) {
                            var horz = i*w;
                            var vert = 550;
                            return 'translate(' + horz + ',' + vert + ')';
                          });
        legend.append('rect')
              .attr('width', legendRectSize)
              .attr('height', legendRectSize)
              .style('fill', function(d, ind) {
                return color(ind);

              })
              .style('stroke', function(d, ind) {
                return color(ind);

              });
        legend.append('text')
          .attr('x', legendRectSize + legendSpacing)
          .attr('y', 15)
          .text(function(d) { return d; });
        function zoom() {
          var currentZoom = d3.event.scale;
          //console.log(currentZoom);
          
          if(currentZoom >= 0.1 && currentZoom < 6){
            svg1.selectAll(".draggable")
              .attr("cy", function(d) { 
                return y(d); 
              })
              .attr("r", 5*currentZoom);
          }
        }
        var body = d3.select("body");
        $(".draggable").draggable({
          revert: true,
          revertDuration: 200,
          cursorAt: { left: -2, top: -2 }, 

          // Register what we're dragging with the drop manager
          start: function (e) {
            // Getting the datum from the standard event target requires more work.
            DragDropManager.dragged = d3.select(e.target).datum();
          },
          // Set cursors based on matches, prepare for a drop
          drag: function (e) {
            matches = DragDropManager.draggedMatchesTarget();
            body.style("cursor",function() {
              return (matches) ? "copy" : "move";
            });
            // Eliminate the animation on revert for matches.
            // We have to set the revert duration here instead of "stop"
            // in order to have the change take effect.
            $(e.target).draggable("option","revertDuration",(matches) ? 0 : 200)
          },
          // Handle the end state. For this example, disable correct drops
          // then reset the standard cursor.
          stop: function (e,ui) {
            // Dropped on a non-matching target.
            if (!DragDropManager.draggedMatchesTarget()) return;
            var targetElement = $(e.target.innerHTML);
            
            $("body").css("cursor","");
            //obj_id, target_class
            // $.ajax({
            //     contentType: 'application/json; charset=utf-8',
            //     url:'/data/topic1',
            //     dataType: 'text',
            //     data: "word="+targetElement.selector+"&topic="+DragDropManager.droppable+"&category="+cat_select,
            //     success: function (results) { 
            //       console.log(results);
            //     },
            //     error: function (request, status, error) {
            //         //alert(error);
            //     }
            // });
          }
        });
    },
    error: function (request, status, error) {
        //alert(error);
    }
  });
}

