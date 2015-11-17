function show_schema(){
  remove_modal_elements();
  $('#myModal').modal('show');
  document.getElementById("myModalLabel").innerHTML = "Select a data set by showing the corresponding number of fingers";
  document.getElementById("myModalFooter").innerHTML = "Swipe left --> to push the dataset box away";
  $.ajax({
    contentType: 'application/json; charset=utf-8',
    url:'/data/retrieve_schema_list',
    dataType: 'json',
    success: function (results) {
      $("#dataset_table tr").remove(); 
      //var table = document.getElementById("dataset_table");
      var table = document.createElement("table");
      table.id = "dataset_table";
      for(var i=0; i<results.length; i++){
        var row = table.insertRow(0);
        var cell1 = row.insertCell(0);
        var cell2 = row.insertCell(1);
        var cell3 = row.insertCell(2);
        cell1.align = "center";
        cell1.innerHTML = results[i][0];
        cell1.width = "20px";
        cell2.align = "left";
        cell2.innerHTML = results[i][1];
        cell2.width = "80px";
        cell3.align = "left";
        cell3.innerHTML = results[i][2];    
      }
      var header = table.createTHead();
      var rowh = header.insertRow(0);   
      var cellh1 = rowh.insertCell(0);
      var cellh2 = rowh.insertCell(1);
      var cellh3 = rowh.insertCell(2);
      cellh1.align = "center";
      cellh1.innerHTML = "<b>ID</b>";
      cellh1.width = "20px";
      cellh2.align = "left";
      cellh2.innerHTML = "<b>Name</b>";
      cellh2.width = "80px";
      cellh3.align = "left";
      cellh3.innerHTML = "<b>Description</b>"; 
      document.getElementById("myModalBody").appendChild(table);
      controller.on('frame', processFrameForNumber);
      if(!controller.connected()) {
        controller.connect();
      }  
    },
    error: function (request, status, error) {
      alert(error);
    }
  });
}
function getNumber(hand,index,hands) {
  var extendedFingerCount = hand.fingers
                                .filter(function(finger, index, fingers) {
                                  return finger.extended
                                }).length;
  if(extendedFingerCount>0) {
    document.getElementById("myModalLabel").innerHTML = "Selected dataset " + extendedFingerCount;
    controller.removeListener('frame',processFrameForNumber);
    //controller.disconnect();

  }
}

function show_info(){
  controller.on('gesture',function(gesture) {
    $('#myModal').modal('hide');
    //controller.disconnect();
  });

  remove_modal_elements();
  $.ajax({
      contentType: 'application/json; charset=utf-8',
      url:'/data/get_info',
      dataType: 'json',
      success: function (results) {
        console.log(results);
        $('#myModal').modal('show');
        document.getElementById("myModalLabel").innerHTML = "Information on plot for dataset : "+results["dbid"];//dataset name also
        document.getElementById("myModalFooter").innerHTML = "Swipe left to push the information box away";
        var div = document.getElementById("myModalBody");
        var contentHtml = "The following information is for the "+results["db_name"]+" dataset - "+results["db_desc"]+"<BR>";
        contentHtml += "The data is clustered based on the field - "+results["scale"]+".<BR>";
        var innerDiv = document.createElement("div");
        if (results["filter"] == ""){
          contentHtml += "No filters have been applied.<BR>";
        }
        else{
          var ff = results["filter"];
          var filters = ff.split(",");
          console.log(filters);
          contentHtml += "The following filter(s) have been applied.<BR>";
          for(var i=0; i<filters.length; i++){
              var rec = filters[i].split("*");
              if (rec[0] == '1'){
                contentHtml += (i+1)+". "+rec[1]+" between "+rec[2]+" and "+rec[3]+"<BR>";
              }
              else{
                contentHtml += (i+1)+". "+rec[1]+" is "+rec[2]+"<BR>";
              }
          }
        }
        innerDiv.innerHTML = contentHtml;
        div.appendChild(innerDiv);
        $.ajax({
          contentType: 'application/json; charset=utf-8',
          url:'/data/get_scatterplot_points',
          dataType: 'json',
          success: function (results) {
            console.log(results);
            var table = document.createElement("table");
            table.id = "cluster_tab";
            for(var i=0; i<results.length; i++){
              var row = table.insertRow(0);
              var cell1 = row.insertCell(0);
              var cell2 = row.insertCell(1);
              cell1.align = "center";
              cell1.innerHTML = results[i]["cluster"];
              cell2.align = "center";
              cell2.innerHTML = results[i]["recs"].length;
            }
            var header = table.createTHead();
            var rowh = header.insertRow(0);   
            var cellh1 = rowh.insertCell(0);
            var cellh2 = rowh.insertCell(1);
            var cellh3 = rowh.insertCell(2);
            cellh1.align = "center";
            cellh1.innerHTML = "<b>Cluster</b>";
            cellh1.width = "70px";
            cellh2.align = "center";
            cellh2.innerHTML = "<b>Number of records</b>";
            cellh2.width = "180px"; 
            
            div.appendChild(table);
          }
        });

      }
    });
}
function remove_modal_elements(){
  $( "#myModalBody" ).empty();
}