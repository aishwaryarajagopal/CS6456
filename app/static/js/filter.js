var filters = new Array(0);
<<<<<<< HEAD
=======
var catfilterResults = [];
var catfieldName="";
>>>>>>> fb4b7e9f4526daf9940b2992c59e44a9564a350e
var btnclick = document.getElementById("btnclick");
var wheel;
var step = 0;
var wheel_len = 0;
<<<<<<< HEAD
=======
var min_val, max_val;
var global_field_name="";

>>>>>>> fb4b7e9f4526daf9940b2992c59e44a9564a350e
function populate_filters(){
	$.ajax({
		contentType: 'application/json; charset=utf-8',
		url:'/data/get_filter_fields',
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
		btnclick.load();
		btnclick.play();
        expandDiv(id, field_name, field_type);
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
		global_field_name = field_name;
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
				catfilterResults = results;
				catfieldName = field_name;
				wheel = new wheelnav("div_"+id);
				wheel_len = results.length;
				wheel.createWheel(results);
			    //wheel.navigateWheel(2);
			}
		});
	}
}
function setNavItem(navIndex){
	var selectedVal = catfilterResults[navIndex];
	console.log(selectedVal);
	var flag = 0;
    for(var xx = 0; xx < filters.length; xx++){
    	if(String(filters[xx]).indexOf(catfieldName) != -1){
    		var str = "2"+"*"+catfieldName+"*"+selectedVal;
    		filters[xx] = str;
    		flag = 1;
    		break;
    	}
    }
    if(flag == 0){
    	var str = "2"+"*"+catfieldName+"*"+selectedVal;
    	filters.push(str)
    }
    console.log(filters);
    $.ajax({
		contentType: 'application/json; charset=utf-8',
		url:'/data/setfilter',
		dataType: 'text',
		data: "filter="+filters.toString(),
		success: function (results) {
		}
	});
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
<<<<<<< HEAD
=======

>>>>>>> fb4b7e9f4526daf9940b2992c59e44a9564a350e
function rotate_wheel() {
	f_children = document.getElementById("filter_home").childNodes;
	var appBanners = document.getElementsByClassName('divclass');
	wheel_div = -1;
	for(var i=0;i<f_children.length;i++) {
		if(f_children[i].childNodes[0].value == 2 && appBanners[i].style.display == "block") {
			wheel_div = f_children[i].id;
			break;
		}
	}
	if (wheel_div!= -1 && wheel != null) {
		wheel.navigateWheel(step);
		step = (step+1)%wheel_len;
	}
}
function bar_filter(amt) {
	f_children = document.getElementById("filter_home").childNodes;
	var appBanners = document.getElementsByClassName('divclass');
<<<<<<< HEAD
	appBanner_div = -1;
	for(var i=0;i<f_children.length;i++) {
		if(f_children[i].childNodes[0].value == 1 && appBanners[i].style.display == "block") {
			var appBanner_div = appBanners[i];
			break;
		}
	}
=======
	var appBanner_div = -1;
	var id=-1;
	for(var i=0;i<f_children.length;i++) {
		if(f_children[i].childNodes[0].value == 1 && appBanners[i].style.display == "block") {
			id = i;
			appBanner_div = appBanners[i];
			break;
		}
	}

>>>>>>> fb4b7e9f4526daf9940b2992c59e44a9564a350e
	if (appBanner_div != -1) {
		if(amt>0) {
			var check = appBanner_div.childNodes[1].style.left < appBanner_div.childNodes[2].style.left;
		} else {
			var check = appBanner_div.childNodes[1].style.left != "0%" || appBanner_div.childNodes[2].style.left != "100%";
		}
		if (check) {
			appBanner_div.childNodes[0].style.left = (parseFloat(appBanner_div.childNodes[0].style.left) + amt).toString()+"%";
			appBanner_div.childNodes[0].style.width = (parseFloat(appBanner_div.childNodes[0].style.width) - amt*2).toString()+"%";
<<<<<<< HEAD
			appBanner_div.childNodes[1].style.left = (parseFloat(appBanner_div.childNodes[1].style.left) + amt).toString()+"%";;
			appBanner_div.childNodes[2].style.left = (parseFloat(appBanner_div.childNodes[2].style.left) - amt).toString()+"%";;
=======

			appBanner_div.childNodes[1].style.left = (parseFloat(appBanner_div.childNodes[1].style.left) + amt).toString()+"%";
			appBanner_div.childNodes[2].style.left = (parseFloat(appBanner_div.childNodes[2].style.left) - amt).toString()+"%";

			var diff = max_val - min_val;

			min_val += diff * amt/100;
			max_val -= diff * amt/100;
			document.getElementById("caption_"+id).innerHTML =  "<center>$" + parseInt(min_val) + " - $" + parseInt(max_val) +"</center>";

			var flag = 0;
			        
	        for(var xx = 0; xx < filters.length; xx++){
	        	if(String(filters[xx]).indexOf(global_field_name) != -1){
	        		var str = "1*"+global_field_name+"*"+parseInt(min_val)+"*"+parseInt(max_val);
	        		filters[xx] = str;
	        		flag = 1;
	        		break;
	        	}
	        }
	        if(flag == 0){
	        	var str = "1*"+global_field_name+"*"+parseInt(min_val)+"*"+parseInt(max_val);
	        	filters.push(str)
	        }
	        console.log(filters);
	        $.ajax({
				contentType: 'application/json; charset=utf-8',
				url:'/data/setfilter',
				dataType: 'text',
				data: "filter="+filters.toString(),
				success: function (results) {
				}
			});
>>>>>>> fb4b7e9f4526daf9940b2992c59e44a9564a350e
		}
	}
}