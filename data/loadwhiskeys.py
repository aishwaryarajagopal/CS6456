import csv
import pymysql
csvfile = open('whiskeys.csv', 'r')
conn = pymysql.connect(host='localhost', port=3306, user='root', passwd='', db='gestviz')
cur = conn.cursor()


fieldnames = ("Name","Rating","Country","Category","Price","ABV","Age","Brand")
reader = csv.DictReader( csvfile, fieldnames)
v_rec_id = 1;
for row in reader:
	if v_rec_id > 1:
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(3, "+str(v_rec_id)+", 22, 'Name', '"+row['Name'].replace("'","''")+"')")
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(3, "+str(v_rec_id)+", 23, 'Rating', '"+row['Rating'].replace("'","''")+"')")
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(3, "+str(v_rec_id)+", 24, 'Country', '"+row['Country'].replace("'","''")+"')")
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(3, "+str(v_rec_id)+", 25, 'Category', '"+row['Category'].replace("'","''")+"')")
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(3, "+str(v_rec_id)+", 26, 'Price', '"+row['Price'].replace("'","''")+"')")
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(3, "+str(v_rec_id)+", 27, 'ABV', '"+row['ABV'].replace("'","''")+"')")
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(3, "+str(v_rec_id)+", 28, 'Age', '"+row['Age'].replace("'","''")+"')")
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(3, "+str(v_rec_id)+", 29, 'Brand', '"+row['Brand'].replace("'","''")+"')")
	
	v_rec_id+= 1;