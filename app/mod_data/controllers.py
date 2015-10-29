from flask import Blueprint, request, render_template, redirect, url_for
import pymysql
import simplejson

mod_data = Blueprint('mod_data', __name__, url_prefix = '/data')

conn = pymysql.connect(host='localhost', port=3306, user='root', passwd='', db='gestviz')
cur = conn.cursor()

@mod_data.route('/index1.html')
def index1():
	return render_template('/mod_data/index1.html')

@mod_data.route('/retrieve_schema')
def retrieve_schema():
	##For creating a new topic
	dbid = request.args.get('dbid', '')
	cur.execute("select db_id, db_name, db_desc from schema_master where db_id = "+dbid)
	result_str = []
	for row in cur:
		result_str.append(row);
	return simplejson.dumps(result_str);

@mod_data.route('/retrieve_schema_list')
def retrieve_schema_list():
	cur.execute("select db_id, db_name, db_desc from schema_master order by db_id")
	result_str = []
	for row in cur:
		result_str.append(row);
	return simplejson.dumps(result_str);

@mod_data.route('/get_fields')
def get_fields():
	#input
	#output
	return "hi"