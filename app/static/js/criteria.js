function populate_criteria(){
	$.ajax({
		contentType: 'application/json; charset=utf-8',
		url:'/data/get_scale_fields',
		dataType: 'json',
		success: function (results) {
		  var radio_home = document.getElementById("radio_home");
		  for(var i=0; i< results.length; i++){
		  	var button = makeRadioButton(i,"scale", results[i]["field_name"]+"#"+results[i]["field_type"], results[i]["field_name"]);
		  	radio_home.appendChild(button);  	
		  }
		}
	});
}


function makeRadioButton(i,name, value, text) {
	var div = document.createElement("div");
	div.id = i+1;
	div.style.width = "500px"; 
	div.style.height = "auto"; 
	div.style.background = "green"; 
	div.style.color = "white"; 
	div.style.border = "thick solid #FFFFFF";
	div.style.align = "middle";
	div.innerHTML = "<h1><center>"+(i+1)+". "+text+"</center></h1>";
	div.onclick = function() {
		setScale(value)
    };

	return div;
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