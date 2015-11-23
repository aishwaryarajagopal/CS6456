var btnclick = document.getElementById("btnclick");
var transMatrix = [1,0,0,1,0,0];
var tooltip_top, tooltip_left = 0;
function setXY(top_val, left_val){
  tooltip_top = top_val;
  tooltip_left = left_val;
}
var cur_color;
var drag_datapoint;
var prev_datapoint = 0;
function myFunction(){
  gesture_output.innerHTML = "Make a fist to bring up datasets";
  // $.ajax({
  //   contentType: 'application/json; charset=utf-8',
  //   url:'/data/setdbid',
  //   dataType: 'text',
  //   data: "dbid=2",
  //   success: function (results) {
      
  //   },
  //   error: function (request, status, error) {
  //       console.log(error);
  //     }
  //   });
  draw_plot();
};

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
            return true;
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

        //Width and height
        w = 900/results1.length;
        h = 250;

        var svg1 = d3.select("#viz")
              .append("svg")
              .attr("width", 900)
              .attr("height", 600)
              .on('click',function(d){
                if(prev_datapoint == 0){
                  console.log("picking point");
                  prev_datapoint = 1;
                }
                else{
                  var position = document.getElementById("viz").getBoundingClientRect(); 
                  drag_datapoint.style("cx", (d3.event.pageX - position.left))
                      .style("cy", d3.event.pageY);

                  // drag_datapoint.style("left", tooltip_left)
                  //     .style("top", tooltip_top);
                  prev_datapoint = 0;
                }
              })
              .append("g")
              .attr("class","gestvizsvg")
              .attr("id", "plotsvg");


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
             .on('click',function(d){
                console.log(d);

              })
             .on('mouseenter',function(d){
                cur_color = this.style.fill;
                var tooltip = d3.select('body').select('div.tooltip');
                var position = document.getElementById("viz").getBoundingClientRect(); 
                 $.ajax({
                  contentType: 'application/json; charset=utf-8',
                  url:'/data/get_point_info',
                  data: "point="+d,
                  dataType: 'text',
                  success: function (pointInfo) {
                    tooltip.style("opacity", 0.8)
                      // .style("left", ( xpos- position.left+5) + "px")
                      // .style("top", (ypos) + "px")
                      .style("left", tooltip_left)
                      .style("top", tooltip_top)
                      .html(pointInfo);
                  }
                });
                 d3.select(this).style("fill", "black").attr("r", 15);
              })
             .on('mouseleave',function(d){
                d3.select(this).style("fill", cur_color).attr("r", 5);
                var tooltip = d3.select('body').select('div.tooltip');
                tooltip.style("opacity", 1e-6);               
              })
             .on('click',function(d){
                drag_datapoint = d3.select(this);
                prev_datapoint = 0;
              })
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
        document.getElementById("plotsvg").setAttributeNS(null, "transform", "matrix(" +  transMatrix.join(' ') + ")");
    },
    error: function (request, status, error) {
        //alert(error);
    }
  });
}

function pan(dx, dy)
{
  var svg1 = document.getElementById("plotsvg");
  transMatrix[4] += dx;
  transMatrix[5] += dy;
        
  newMatrix = "matrix(" +  transMatrix.join(' ') + ")";
  svg1.setAttributeNS(null, "transform", newMatrix);
}
function zoom(scale)
{
  var svg1 = document.getElementById("plotsvg");
  for (var i=0; i<transMatrix.length; i++)
  {
    transMatrix[i] *= scale;
  }
  transMatrix[4] += (1-scale)*w/2;
  transMatrix[5] += (1-scale)*h/2;
        
  newMatrix = "matrix(" +  transMatrix.join(' ') + ")";
  console.log(newMatrix);
  svg1.setAttributeNS(null, "transform", newMatrix);
}