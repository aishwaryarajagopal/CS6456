import csv
import pymysql
csvfile = open('a3-CoffeeData.csv', 'r')
conn = pymysql.connect(host='localhost', port=3306, user='root', passwd='', db='gestviz')
cur = conn.cursor()


fieldnames = ("Added_Sugars,Added_Sugars/#agg,Alcohol,Alcohol/#agg,Calories,Calories/#agg,Display_Name,Drkgreen_Vegetables,Drkgreen_Vegetables/#agg,Drybeans_Peas,Drybeans_Peas/#agg,Factor,Factor/#agg,Food_Code,Food_Code/#agg,Fruits,Fruits/#agg,Grains,Grains/#agg,Increment,Increment/#agg,Meats,Meats/#agg,Milk,Milk/#agg,Multiplier,Multiplier/#agg,Oils,Oils/#agg,Orange_Vegetables,Orange_Vegetables/#agg,Other_Vegetables,Other_Vegetables/#agg,Portion_Amount,Portion_Amount/#agg,Portion_Default,Portion_Default/#agg,Portion_Display_Name,Saturated_Fats,Saturated_Fats/#agg,Solid_Fats,Solid_Fats/#agg,Soy,Soy/#agg,Starchy_vegetables,Starchy_vegetables/#agg,Vegetables,Vegetables/#agg,Whole_Grains,Whole_Grains/#agg")
reader = csv.DictReader( csvfile, fieldnames)
v_rec_id = 1;
for row in reader:
	if v_rec_id > 1:
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(2, "+str(v_rec_id)+", 14, 'date', '"+row['date'].replace("'","''")+"')")
	v_rec_id+= 1;