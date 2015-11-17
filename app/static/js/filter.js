var filters = new Array(0);
function populate_filters(){
	$.ajax({
		contentType: 'application/json; charset=utf-8',
		url:'/data/get_scale_fields',
		dataType: 'json',
		success: function (results) {
			console.log(results);
		  	var filter_home = document.getElementById("filter_home");
			for(var i=0; i< results.length; i++){
				var div = makediv(i, results[i]["field_name"], results[i]["field_type"]);
				filter_home.appendChild(div);  	
			}
		}
	});
}

function makediv(id, field_name, field_type) {
	var div = document.createElement("div");
	div.id = id;
	div.style.width = "500px"; 
	div.style.height = "auto"; 
	div.style.background = "green"; 
	div.style.color = "white"; 
	div.style.border = "thick solid #FFFFFF";
	div.innerHTML = "<input type = 'hidden' value = '"+field_type+"' name = 'f_type' /> <h1>"+field_name+"</h1> <div id = 'div_"+id+"' class = 'divclass' style = 'display:none;'></div><div id = 'caption_"+id+"' style = 'height : 50px;align:middle;'></div>";
	div.onclick = function() {
        expandDiv(id, field_name, field_type)
    };
	return div;
}
function expandDiv(id, field_name, field_type){

	console.log(id, field_name, field_type);
	var appBanners = document.getElementsByClassName('divclass');
	for (var i = 0; i < appBanners.length; i ++) {
	    appBanners[i].style.display = 'none';
	    document.getElementById("caption_"+i).style.display = 'none';
	}
	
	//1*profit*1*10,2*category*Coffee
	var innerDiv = document.getElementById("div_"+id);
	innerDiv.style.display = 'block';
	document.getElementById("caption_"+id).style.display = 'block';
	if(field_type == 1){
		$.ajax({
			contentType: 'application/json; charset=utf-8',
			url:'/data/get_filter_values_num',
			dataType: 'json',
			data: "field="+field_name,
			success: function (results) {
				//Get min/max
				min_val = parseFloat(results[0]);
				max_val = parseFloat(results[1]);
				$( "#div_"+id ).slider({
				  range: true,
			      min: min_val,
			      max: max_val,
			      values: [ min_val, max_val ],
			      slide: function( event, ui ) {
			        document.getElementById("caption_"+id).innerHTML =  "<center>$" + ui.values[ 0 ] + " - $" + ui.values[ 1 ] +"</center>";
			        var flag = 0;
			        
			        for(var xx = 0; xx < filters.length; xx++){
			        	if(String(filters[xx]).indexOf(field_name) != -1){
			        		var str = field_type+"*"+field_name+"*"+ui.values[ 0 ]+"*"+ui.values[ 1 ];
			        		filters[xx] = str;
			        		flag = 1;
			        		break;
			        	}
			        }
			        if(flag == 0){
			        	var str = field_type+"*"+field_name+"*"+ui.values[ 0 ]+"*"+ui.values[ 1 ];
			        	filters.push(str)
			        }
			      }
			    });
			    $.ajax({
					contentType: 'application/json; charset=utf-8',
					url:'/data/setfilter',
					dataType: 'text',
					data: "filter="+filters.toString(),
					success: function (results) {
					}
				});
			}
		});
	}
	if(field_type == 2){
		//Get categories
		$.ajax({
			contentType: 'application/json; charset=utf-8',
			url:'/data/get_filter_values_cat',
			dataType: 'json',
			data: "field="+field_name,
			success: function (results) {
				var wheel = new wheelnav("div_"+id);
				wheel.createWheel(results);
			    //wheel.navigateWheel(2);

			    var flag = 0;
			    for(var xx = 0; xx < filters.length; xx++){
		        	if(String(filters[xx]).indexOf(field_name) != -1){
		        		var str = field_type+"*"+field_name+"*"+"Regular";
		        		filters[xx] = str;
		        		flag = 1;
		        		break;
		        	}
		        }
		        if(flag == 0){
		        	var str = field_type+"*"+field_name+"*"+"Regular";
		        	filters.push(str)
		        }
		        $.ajax({
					contentType: 'application/json; charset=utf-8',
					url:'/data/setfilter',
					dataType: 'text',
					data: "filter="+filters.toString(),
					success: function (results) {
					}
				});
			}
		});
	}
}
function setScale(val){
	data_rec = val.split("#");
	$.ajax({
		contentType: 'application/json; charset=utf-8',
		url:'/data/setscale',
		dataType: 'text',
		data: "scale="+data_rec[0]+"&scaletype="+data_rec[1],
		success: function (results) {
			console.log(results);
		}
	});
}