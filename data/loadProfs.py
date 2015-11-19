import csv
import pymysql
csvfile = open('Professors.csv', 'r')
conn = pymysql.connect(host='localhost', port=3306, user='root', passwd='', db='gestviz')
cur = conn.cursor()


fieldnames = ("Name","University","JoinYear","Rank","Subfield","Bachelors","Masters","Doctorate","PostDoc","Sources1","Sources2","Sources3","Sources4")
reader = csv.DictReader( csvfile, fieldnames)
v_rec_id = 1;
for row in reader:
	if v_rec_id > 1:
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(4, "+str(v_rec_id)+", 1, 'Name', '"+row['Name'].replace("'","''")+"')")
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(4, "+str(v_rec_id)+", 2, 'University', '"+row['University'].replace("'","''")+"')")
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(4, "+str(v_rec_id)+", 3, 'JoinYear', '"+row['JoinYear'].replace("'","''")+"')")
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(4, "+str(v_rec_id)+", 4, 'Rank', '"+row['Rank'].replace("'","''")+"')")
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(4, "+str(v_rec_id)+", 5, 'Subfield', '"+row['Subfield'].replace("'","''")+"')")
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(4, "+str(v_rec_id)+", 6, 'Bachelors', '"+row['Bachelors'].replace("'","''")+"')")
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(4, "+str(v_rec_id)+", 7, 'Masters', '"+row['Masters'].replace("'","''")+"')")
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(4, "+str(v_rec_id)+", 8, 'Doctorate', '"+row['Doctorate'].replace("'","''")+"')")
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(4, "+str(v_rec_id)+", 9, 'PostDoc', '"+row['PostDoc'].replace("'","''")+"')")
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(4, "+str(v_rec_id)+", 10, 'Sources1', '"+row['Sources1'].replace("'","''")+"')")
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(4, "+str(v_rec_id)+", 11, 'Sources2', '"+row['Sources2'].replace("'","''")+"')")
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(4, "+str(v_rec_id)+", 12, 'Sources3', '"+row['Sources3'].replace("'","''")+"')")
		cur.execute("insert into gestviz_data(db_id,rec_id,field_id,field_name,value) values(4, "+str(v_rec_id)+", 13, 'Sources4', '"+row['Sources4'].replace("'","''")+"')")

	v_rec_id+= 1;