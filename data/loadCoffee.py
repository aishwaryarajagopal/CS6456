import csv
import pymysql
csvfile = open('a3-CoffeeData.csv', 'r')
conn = pymysql.connect(host='localhost', port=3306, user='root', passwd='', db='gestviz')
cur = conn.cursor()


fieldnames = ("date","sales","profit","region","state","category","type","caffeination")
reader = csv.DictReader( csvfile, fieldnames)
v_rec_id = 1;
for row in reader:
	if v_rec_id > 1:
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(2, "+str(v_rec_id)+", 14, 'date', '"+row['date'].replace("'","''")+"')")
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(2, "+str(v_rec_id)+", 15, 'sales', '"+row['sales'].replace("'","''")+"')")
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(2, "+str(v_rec_id)+", 16, 'profit', '"+row['profit'].replace("'","''")+"')")
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(2, "+str(v_rec_id)+", 17, 'region', '"+row['region'].replace("'","''")+"')")
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(2, "+str(v_rec_id)+", 18, 'state', '"+row['state'].replace("'","''")+"')")
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(2, "+str(v_rec_id)+", 19, 'category', '"+row['category'].replace("'","''")+"')")
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(2, "+str(v_rec_id)+", 20, 'type', '"+row['type'].replace("'","''")+"')")
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(2, "+str(v_rec_id)+", 21, 'caffeination', '"+row['caffeination'].replace("'","''")+"')")
	v_rec_id+= 1;