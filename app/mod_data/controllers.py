
from py2neo import Graph, Path, Node, Relationship, neo4j
from flask import Blueprint, request, render_template, redirect, url_for
import gzip
import simplejson
from pymongo import MongoClient
import nltk
from nltk.collocations import *
from nltk.tokenize import word_tokenize
import datetime as dt1
import json, re
from nltk.corpus import stopwords
from nltk.stem.porter import PorterStemmer
from datetime import date, datetime, timedelta
import sys, string, random, numpy
from llda import LLDA
from optparse import OptionParser
from nltk.corpus import reuters

stemmer = PorterStemmer()

mod_data = Blueprint('mod_data', __name__, url_prefix = '/data')
cl = MongoClient()


@mod_data.route('/index1.html')
def index1():
	return render_template('/mod_data/index1.html')

@mod_data.route('/wordtree_old')
def wordtree():
	return render_template('/mod_data/wordtree.html')

@mod_data.route('/')
def index():
	# db = cl["amazon"]
	# return_string = []
	# dateRange = db.shoekeys.find({ 'date': { '$exists': 'true',  '$gt' : '1969-12-31'  } })
	# darr = [i['date'] for i in dateRange]
	# start_dt = min(darr);
	# end_dt = max(darr);
	# print start_dt
	# print end_dt

	# wordFreq = db.shoekeys.aggregate([
	#   {'$match': { 'score': { '$lte': '3.0' } } }, 
	#   {'$unwind': '$wordlist' },
	#   {'$project': { '_id': 0, 'wordlist': 1, 'date':1, 'month': { '$substr': [ '$date', 0, 7 ] } } },
	#   { "$group": {
	#         "_id": {
	#             "wordlist": "$wordlist",
	#             "date": "$month"
	#         },
	#         "wordCount": { "$sum": 1 }
	#     }},
	#   { "$group": {
	#         "_id": "$_id.wordlist",
	#         "dateCounts": { 
	#             "$push": { 
	#                 "date": "$_id.date",
	#                 "count": "$wordCount"
	#             },
	#         },
	#         "wordCount": { "$sum": "$wordCount" }
	#     }},
	#     {'$sort': { 'wordCount': -1 } },
	#   { '$limit': 10 }
	# ])['result']
	# for word in wordFreq:
	#   dtcArr = {}
	#   newarr = [];
	#   for dtc in word['dateCounts']:
	# 	dtcArr[dtc['date']] = dtc['count']
	#   curdate = datetime.strptime(start_dt, "%Y-%m-%d")
	#   last_date = datetime.strptime(end_dt, "%Y-%m-%d");
	#   while curdate < last_date:
	#   	strpart = str(curdate)[0:7];
	# 	newarr.append(dtcArr.get(strpart, 0))
	# 	curdate = datetime.strptime(strpart+"-01", "%Y-%m-%d") + dt1.timedelta(days=31);
	#   return_string.append({
	# 		"key": word["_id"],
	# 		"values": newarr
	# 	})
	return_string = [{"values": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 16, 0, 5, 15, 100, 38, 53, 5, 0, 0, 0, 238, 12, 101, 1, 66, 0, 1, 16, 313, 49, 2, 2, 47, 17, 32, 218, 67, 37, 243, 91, 145, 82, 9, 58, 33, 58, 107, 31, 17, 108, 310, 615, 109, 162, 100, 263, 71, 181, 126, 166, 119, 241, 272, 143, 96, 263, 118, 226, 128, 106, 177, 98, 100, 80, 100, 203, 124, 74, 90, 208, 230, 108, 91, 137, 92, 170, 70, 222, 109, 246, 148, 27, 157, 100, 143, 278, 149, 198, 312, 276, 309, 256, 168, 114, 354, 291, 317, 573, 252, 154, 390, 459, 498, 334, 689, 276, 646, 384, 358, 572, 687, 502, 797, 1688, 582], "key": "shoes"}, {"values": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0, 11, 3, 0, 0, 0, 5, 0, 0, 1, 51, 14, 0, 65, 0, 57, 0, 65, 0, 1, 1, 1, 84, 369, 112, 0, 1, 14, 43, 587, 340, 97, 32, 98, 22, 63, 57, 2, 56, 60, 46, 135, 25, 19, 98, 92, 394, 82, 188, 97, 212, 52, 155, 111, 151, 125, 111, 230, 199, 90, 219, 98, 148, 101, 180, 89, 95, 78, 154, 80, 95, 97, 34, 35, 41, 108, 20, 69, 121, 56, 307, 125, 118, 85, 236, 99, 79, 305, 197, 145, 136, 223, 249, 257, 191, 243, 354, 239, 182, 369, 318, 642, 200, 163, 222, 231, 363, 367, 251, 456, 341, 640, 324, 327, 468, 580, 614, 1374, 1547, 647], "key": "shoe"}, {"values": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 11, 60, 0, 0, 0, 0, 108, 0, 20, 0, 0, 0, 0, 0, 0, 7, 81, 0, 0, 3, 6, 8, 541, 105, 103, 141, 306, 88, 216, 45, 6, 21, 35, 37, 70, 4, 4, 72, 87, 531, 63, 143, 42, 145, 55, 98, 100, 118, 77, 209, 164, 89, 78, 56, 86, 77, 134, 86, 68, 52, 65, 150, 35, 180, 51, 58, 107, 184, 49, 28, 41, 90, 143, 86, 115, 84, 122, 141, 68, 94, 121, 52, 77, 119, 138, 68, 376, 246, 236, 284, 247, 114, 178, 272, 314, 198, 296, 204, 272, 258, 391, 163, 313, 344, 448, 162, 371, 503, 842, 511, 1738, 1695, 742], "key": "size"}, {"values": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 8, 0, 0, 11, 0, 0, 1, 0, 5, 21, 95, 7, 63, 7, 0, 0, 0, 157, 0, 66, 0, 1, 1, 4, 7, 14, 28, 2, 1, 0, 1, 14, 15, 20, 32, 299, 94, 46, 67, 5, 53, 51, 44, 59, 26, 12, 62, 83, 185, 81, 64, 58, 124, 21, 68, 79, 142, 45, 122, 220, 109, 68, 145, 65, 77, 169, 150, 80, 53, 50, 90, 82, 77, 110, 65, 40, 123, 251, 83, 37, 96, 57, 85, 44, 101, 96, 135, 100, 86, 143, 110, 124, 163, 156, 122, 351, 243, 282, 225, 178, 96, 308, 190, 211, 419, 288, 270, 259, 311, 235, 324, 345, 190, 325, 255, 302, 501, 738, 484, 1237, 1141, 607], "key": "be"}, {"values": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 7, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 78, 64, 0, 0, 65, 0, 199, 28, 37, 0, 0, 0, 0, 0, 221, 68, 0, 2, 4, 0, 2, 132, 21, 0, 235, 11, 18, 26, 3, 46, 8, 41, 66, 8, 5, 52, 62, 279, 33, 59, 19, 50, 50, 55, 56, 107, 30, 74, 114, 74, 45, 41, 76, 70, 42, 56, 73, 22, 58, 94, 53, 60, 84, 47, 133, 43, 34, 31, 34, 61, 63, 97, 64, 113, 114, 267, 74, 69, 224, 80, 127, 164, 100, 78, 239, 206, 248, 92, 195, 94, 373, 372, 408, 106, 155, 246, 206, 302, 345, 174, 532, 157, 315, 316, 270, 411, 742, 319, 898, 858, 531], "key": "pair"}, {"values": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 0, 2, 3, 0, 0, 0, 37, 0, 0, 0, 0, 1, 0, 0, 101, 0, 0, 1, 1, 25, 1, 16, 30, 4, 149, 10, 64, 18, 4, 4, 13, 23, 115, 11, 6, 73, 24, 225, 68, 93, 46, 88, 23, 58, 41, 101, 80, 49, 102, 110, 44, 121, 46, 168, 193, 102, 35, 19, 34, 129, 130, 150, 23, 91, 55, 34, 221, 52, 32, 64, 99, 34, 36, 69, 90, 129, 63, 36, 118, 125, 46, 106, 66, 248, 239, 126, 120, 176, 139, 94, 205, 189, 457, 71, 106, 275, 250, 296, 217, 147, 362, 196, 220, 156, 268, 380, 391, 172, 578, 786, 397], "key": "wear"}, {"values": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 2, 0, 1, 0, 0, 11, 0, 0, 103, 0, 0, 43, 0, 49, 0, 64, 1, 0, 0, 0, 0, 0, 0, 0, 7, 1, 0, 15, 15, 36, 2, 138, 2, 17, 32, 1, 4, 44, 70, 31, 20, 10, 59, 45, 173, 49, 47, 37, 36, 37, 63, 67, 140, 87, 106, 63, 66, 32, 176, 50, 107, 51, 53, 68, 28, 22, 214, 79, 56, 80, 25, 48, 14, 60, 116, 43, 90, 59, 217, 67, 144, 41, 241, 65, 42, 310, 176, 79, 78, 62, 41, 305, 117, 162, 226, 52, 118, 233, 261, 145, 81, 144, 100, 94, 160, 248, 208, 148, 203, 217, 139, 222, 294, 710, 347, 799, 511, 206], "key": "feet"}, {"values": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 35, 8, 51, 13, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 7, 1, 0, 2, 1, 32, 2, 7, 12, 23, 68, 168, 7, 16, 27, 9, 21, 4, 132, 111, 8, 4, 64, 33, 295, 73, 50, 32, 99, 22, 27, 47, 74, 58, 35, 63, 102, 49, 59, 39, 122, 128, 143, 28, 44, 24, 23, 58, 97, 36, 29, 24, 36, 82, 55, 26, 78, 83, 100, 79, 110, 88, 122, 162, 49, 222, 60, 97, 135, 95, 124, 93, 163, 142, 166, 81, 405, 132, 54, 165, 95, 156, 95, 158, 146, 176, 173, 203, 91, 417, 157, 113, 285, 266, 353, 1167, 778, 403], "key": "have"}, {"values": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 37, 1, 39, 0, 9, 0, 3, 0, 0, 0, 1, 2, 0, 0, 6, 3, 0, 1, 8, 0, 51, 29, 11, 0, 10, 28, 26, 61, 14, 1, 6, 21, 60, 12, 11, 54, 59, 310, 57, 36, 113, 106, 53, 89, 52, 105, 53, 125, 61, 68, 111, 343, 80, 81, 171, 94, 92, 47, 31, 222, 28, 50, 62, 38, 44, 31, 47, 35, 20, 74, 33, 49, 58, 158, 95, 111, 83, 46, 228, 143, 50, 110, 114, 112, 146, 123, 98, 138, 200, 126, 186, 221, 131, 156, 86, 295, 188, 168, 154, 246, 511, 80, 221, 126, 153, 331, 535, 337, 537, 546, 246], "key": "comfortable"}, {"values": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 13, 0, 0, 0, 0, 0, 15, 0, 5, 5, 0, 1, 0, 7, 0, 9, 0, 37, 0, 101, 0, 0, 0, 0, 108, 21, 28, 0, 0, 0, 3, 11, 18, 0, 34, 80, 2, 30, 39, 4, 82, 10, 12, 40, 6, 3, 30, 240, 480, 28, 57, 21, 55, 13, 60, 51, 79, 51, 91, 108, 105, 42, 57, 111, 36, 108, 71, 94, 31, 46, 38, 85, 124, 50, 17, 19, 74, 202, 19, 56, 24, 38, 30, 28, 50, 86, 120, 115, 23, 20, 76, 20, 128, 51, 101, 171, 201, 139, 79, 69, 35, 69, 75, 176, 330, 117, 119, 128, 149, 185, 229, 174, 98, 160, 192, 102, 157, 180, 292, 268, 579, 244], "key": "good"}]
	return json.dumps(return_string)


@mod_data.route('/2')
def index2():
	# db = cl["amazon"]
	# return_string = []
	# dateRange = db.shoekeys.find({ 'date': { '$exists': 'true',  '$gt' : '1969-12-31'  } })
	# darr = [i['date'] for i in dateRange]
	# start_dt = min(darr);
	# end_dt = max(darr);
	# print start_dt
	# print end_dt

	# wordFreq = db.shoekeys.aggregate([
	#   {'$match': { 'score': { '$gte': '4.0' } } }, 
	#   {'$unwind': '$wordlist' },
	#   {'$project': { '_id': 0, 'wordlist': 1, 'date':1, 'month': { '$substr': [ '$date', 0, 7 ] } } },
	#   { "$group": {
	#         "_id": {
	#             "wordlist": "$wordlist",
	#             "date": "$month"
	#         },
	#         "wordCount": { "$sum": 1 }
	#     }},
	#   { "$group": {
	#         "_id": "$_id.wordlist",
	#         "dateCounts": { 
	#             "$push": { 
	#                 "date": "$_id.date",
	#                 "count": "$wordCount"
	#             },
	#         },
	#         "wordCount": { "$sum": "$wordCount" }
	#     }},
	#     {'$sort': { 'wordCount': -1 } },
	#   { '$limit': 10 }
	# ])['result']
	# for word in wordFreq:
	#   dtcArr = {}
	#   newarr = [];
	#   for dtc in word['dateCounts']:
	# 	dtcArr[dtc['date']] = dtc['count']
	#   curdate = datetime.strptime(start_dt, "%Y-%m-%d")
	#   last_date = datetime.strptime(end_dt, "%Y-%m-%d");
	#   while curdate < last_date:
	#   	strpart = str(curdate)[0:7];
	# 	newarr.append(dtcArr.get(strpart, 0))
	# 	curdate = datetime.strptime(strpart+"-01", "%Y-%m-%d") + dt1.timedelta(days=31);
	#   return_string.append({
	# 		"key": word["_id"],
	# 		"values": newarr
	# 	})
	return_string = [{"values": [0, 0, 0, 0, 0, 0, 0, 17, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 47, 257, 11, 284, 66, 61, 93, 249, 132, 1, 1, 63, 86, 78, 64, 42, 435, 60, 227, 73, 200, 46, 97, 18, 52, 134, 185, 63, 42, 49, 133, 16, 58, 240, 190, 250, 294, 682, 255, 146, 291, 301, 118, 67, 357, 349, 684, 113, 92, 804, 345, 2050, 761, 1033, 627, 1228, 560, 762, 705, 877, 736, 665, 759, 961, 789, 580, 645, 696, 840, 1004, 623, 588, 899, 600, 546, 853, 753, 738, 949, 458, 643, 765, 686, 913, 642, 818, 444, 736, 764, 930, 648, 904, 899, 878, 1174, 793, 1301, 779, 1041, 1344, 753, 878, 1030, 1131, 937, 1004, 1335, 1486, 1289, 1624, 1494, 1544, 1080, 1253, 1277, 1666, 1679, 1455, 1971, 2226, 3562, 2329, 5596, 6153, 3577], "key": "comfortable"}, {"values": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 278, 379, 113, 413, 98, 126, 101, 138, 132, 2, 109, 65, 151, 279, 61, 54, 439, 205, 485, 162, 282, 15, 152, 185, 93, 12, 212, 81, 106, 77, 111, 157, 46, 329, 268, 429, 137, 1239, 454, 154, 340, 377, 73, 80, 445, 258, 557, 85, 79, 900, 314, 3519, 553, 978, 412, 1039, 516, 927, 1021, 933, 760, 815, 759, 1064, 928, 608, 611, 717, 889, 688, 624, 866, 691, 669, 505, 572, 497, 792, 881, 612, 818, 384, 526, 1007, 520, 746, 599, 701, 589, 954, 717, 900, 785, 926, 837, 865, 1554, 739, 996, 904, 927, 919, 1114, 1000, 883, 1021, 1350, 1362, 1281, 1350, 1253, 1996, 977, 1267, 1075, 1292, 1102, 1314, 1936, 1981, 3394, 2458, 4480, 5065, 3432], "key": "shoes"}, {"values": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 237, 331, 92, 338, 144, 78, 91, 139, 33, 65, 110, 14, 102, 255, 131, 53, 43, 3, 183, 69, 166, 12, 48, 67, 53, 112, 25, 83, 107, 57, 136, 104, 59, 167, 242, 261, 288, 707, 434, 162, 153, 137, 101, 75, 148, 208, 289, 67, 49, 440, 241, 1498, 501, 506, 434, 804, 305, 510, 511, 562, 376, 668, 373, 925, 778, 433, 437, 577, 630, 623, 555, 445, 584, 519, 551, 625, 703, 475, 591, 359, 901, 374, 450, 787, 429, 645, 464, 458, 443, 1132, 503, 735, 789, 930, 811, 598, 847, 832, 1277, 1015, 848, 948, 1276, 643, 1157, 886, 975, 1003, 1250, 1045, 1423, 1501, 1113, 967, 1460, 1453, 1197, 1421, 1517, 1980, 2686, 1951, 4077, 4110, 3103], "key": "pair"}, {"values": [0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 113, 12, 69, 210, 21, 7, 161, 140, 451, 35, 54, 89, 51, 68, 120, 26, 21, 41, 403, 110, 42, 216, 131, 40, 37, 119, 1, 65, 1, 106, 153, 96, 52, 102, 142, 87, 156, 1104, 98, 87, 323, 228, 55, 25, 133, 341, 354, 72, 52, 430, 393, 1787, 538, 712, 290, 715, 432, 601, 798, 531, 600, 314, 511, 866, 460, 463, 557, 508, 778, 625, 462, 527, 282, 359, 359, 710, 570, 429, 531, 639, 361, 161, 569, 751, 264, 390, 380, 685, 373, 343, 456, 736, 385, 699, 719, 847, 613, 824, 850, 875, 809, 634, 712, 718, 749, 740, 1023, 776, 1095, 966, 958, 1522, 745, 1076, 614, 1057, 1052, 1290, 1320, 996, 2515, 1933, 4313, 5773, 2767], "key": "great"}, {"values": [0, 0, 0, 0, 0, 0, 0, 15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 70, 407, 87, 282, 134, 185, 130, 153, 146, 40, 54, 189, 136, 262, 71, 1, 85, 40, 172, 165, 221, 202, 306, 39, 35, 32, 123, 75, 56, 151, 55, 128, 7, 165, 112, 169, 76, 156, 168, 172, 319, 187, 33, 65, 332, 344, 282, 55, 51, 692, 254, 1538, 430, 655, 346, 1024, 327, 644, 717, 786, 467, 477, 467, 605, 864, 389, 464, 469, 1026, 422, 463, 329, 555, 425, 476, 417, 548, 420, 415, 398, 449, 110, 439, 935, 390, 612, 460, 303, 574, 567, 515, 559, 854, 758, 386, 485, 720, 609, 598, 848, 467, 848, 894, 619, 794, 823, 1134, 1035, 1125, 1002, 761, 1240, 904, 938, 631, 1036, 615, 1231, 1033, 1539, 2394, 1684, 3025, 3625, 2352], "key": "shoe"}, {"values": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 84, 3, 11, 1, 0, 6, 0, 0, 56, 2, 1, 26, 65, 0, 26, 0, 424, 0, 15, 101, 0, 77, 74, 84, 35, 0, 50, 2, 1, 0, 72, 35, 46, 60, 75, 116, 33, 22, 114, 148, 171, 121, 30, 38, 50, 129, 265, 57, 45, 165, 145, 1127, 399, 498, 163, 523, 198, 463, 305, 482, 256, 452, 499, 571, 521, 344, 424, 568, 385, 282, 256, 263, 329, 311, 319, 568, 247, 335, 282, 112, 396, 207, 432, 239, 167, 458, 339, 450, 369, 585, 446, 413, 462, 798, 324, 327, 554, 636, 564, 888, 655, 605, 559, 582, 564, 966, 697, 1091, 1085, 973, 998, 1340, 905, 973, 840, 1127, 672, 733, 1214, 1764, 2532, 1802, 3319, 4367, 2273], "key": "size"}, {"values": [0, 0, 0, 0, 0, 0, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 0, 0, 0, 0, 0, 0, 0, 258, 25, 344, 18, 190, 45, 42, 1, 20, 54, 0, 89, 46, 107, 2, 27, 0, 362, 6, 77, 185, 21, 143, 93, 23, 36, 38, 85, 49, 66, 2, 31, 212, 152, 101, 131, 193, 238, 165, 188, 111, 22, 35, 53, 285, 307, 84, 58, 363, 210, 1068, 459, 513, 127, 686, 521, 309, 546, 512, 328, 425, 509, 473, 257, 301, 369, 379, 466, 277, 375, 334, 470, 355, 523, 475, 269, 163, 383, 195, 240, 237, 623, 378, 459, 514, 326, 566, 346, 450, 288, 712, 695, 613, 454, 434, 761, 607, 511, 658, 527, 589, 781, 563, 706, 637, 832, 614, 850, 806, 693, 1098, 594, 955, 752, 696, 717, 913, 1135, 987, 1983, 1560, 2996, 2928, 1859], "key": "feet"}, {"values": [0, 0, 0, 0, 0, 0, 0, 15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 7, 71, 24, 72, 0, 97, 52, 84, 61, 17, 55, 8, 45, 294, 177, 2, 11, 8, 244, 3, 95, 67, 95, 85, 0, 17, 102, 7, 40, 52, 65, 46, 5, 23, 43, 32, 38, 39, 166, 112, 168, 97, 18, 30, 41, 215, 148, 55, 51, 175, 176, 1096, 317, 309, 220, 772, 358, 382, 428, 389, 413, 547, 308, 317, 299, 386, 463, 500, 497, 372, 311, 273, 300, 344, 236, 486, 546, 418, 281, 175, 280, 236, 426, 574, 301, 411, 385, 408, 283, 557, 389, 371, 964, 515, 581, 381, 584, 577, 602, 601, 622, 599, 749, 665, 639, 871, 1178, 756, 1193, 833, 1067, 1365, 611, 913, 757, 914, 746, 875, 1138, 1562, 1855, 1623, 2779, 3145, 1847], "key": "wear"}, {"values": [2, 0, 0, 0, 0, 0, 0, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 114, 0, 205, 52, 59, 75, 40, 33, 38, 108, 0, 116, 139, 28, 1, 17, 44, 92, 79, 97, 45, 132, 1, 35, 2, 72, 146, 61, 22, 87, 33, 43, 80, 82, 179, 58, 703, 107, 65, 108, 155, 34, 43, 194, 174, 249, 29, 39, 402, 171, 983, 442, 473, 207, 367, 226, 338, 444, 359, 354, 566, 387, 494, 451, 283, 355, 232, 511, 434, 449, 437, 210, 253, 279, 565, 268, 293, 274, 209, 322, 363, 508, 472, 229, 351, 351, 472, 368, 401, 288, 381, 378, 345, 407, 502, 675, 438, 447, 862, 477, 383, 839, 635, 554, 542, 796, 1056, 1127, 1066, 956, 865, 727, 1006, 685, 738, 806, 790, 1055, 1127, 1891, 1418, 2443, 3074, 1786], "key": "be"}, {"values": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 94, 212, 46, 203, 51, 148, 62, 19, 298, 36, 0, 63, 37, 66, 129, 12, 455, 215, 198, 23, 75, 51, 132, 15, 86, 0, 148, 25, 77, 74, 47, 32, 16, 183, 54, 82, 48, 1282, 130, 155, 250, 94, 41, 22, 245, 134, 252, 24, 28, 306, 156, 1338, 305, 515, 115, 665, 327, 276, 575, 257, 185, 197, 244, 428, 454, 184, 337, 395, 318, 207, 269, 262, 494, 271, 396, 236, 473, 601, 282, 176, 215, 381, 322, 353, 170, 374, 159, 303, 247, 457, 347, 473, 478, 788, 339, 386, 544, 442, 436, 928, 450, 568, 421, 367, 481, 580, 763, 679, 767, 892, 1175, 1069, 441, 506, 638, 517, 588, 672, 1003, 949, 1371, 1583, 2630, 3030, 1765], "key": "good"}]
	
	return json.dumps(return_string)

@mod_data.route('/getComments')
def getComments():
	keywordString = request.args.get('key', '')
	db = cl["amazon2"]
	keywordArr = keywordString.split("|")
	query = []
	for keyword in keywordArr:
		query.append({'text': {'$regex': '.*'+keyword+'*'}});
	results = db.shoes1.find({'$and': query}, { 'text': 1, '_id': 0 }).distinct('text');
	result_set=[];
	for word in results:
		print word;
		result_set.append(word+"<BR>-----------------------------<BR>");
	return ''.join(result_set)
@mod_data.route('/getComments2')
def getComments2():
	db = cl["amazon2"]
	keywordString = request.args.get('key', '')
	#keywordString = "confortable|slick";
	keywordArr = keywordString.split("|")
	keywordString2 = "";
	for keyword in keywordArr:
		keywordString2 = keywordString2 + "\""+keyword+"\" "
	query = []
	results2 = db.shoes1.find({ '$text': { '$search': keywordString2}}).distinct('text');
	result_set=[];
	result_set2={};
	result_set3 = [];
	for word in results2:
		if(re.search(".*"+keywordString.replace("|", ".*")+".*",  word)):
			result_set.append(word)
	for keyword in keywordArr:	
		temp_arr1,temp_arr2, temp_arr3 = [],[],[];
		for comment in result_set:
			temp_arr1 = comment.split(keyword, 1);
			temp_arr2.append(temp_arr1[0]);
			temp_arr3.append(temp_arr1[1]);
		result_set = temp_arr3;
		result_set2[keyword] = temp_arr2;
		result_set3.append(temp_arr2);
	result_set3.append(result_set)
	result_set2["remaining"] = result_set;
	return simplejson.dumps(result_set3)
@mod_data.route('/wordtree')
def showWordTree():
	return render_template('/mod_data/wordtree2.html')
@mod_data.route('/loadCat')
def loadCat():
	db = cl["amazon2"]
	return_string = {}
	wordString = []
	cats = db.catkeys.distinct('category');
	wordFreq = db.catkeys.find({"category":cats[0]});
	
	dateRange = db.catkeys.find_one({"category":cats[0]},{'st_dt':1,'end_dt':1, '_id' : 0})
	start_dt =  dateRange['st_dt']
	end_dt =  dateRange['end_dt']
	print start_dt
	print end_dt

	return_string["categories"] = cats;
	for word in wordFreq:
	  dtcArrPositive,dtcArrNegative,dtcArrWords1, dtcArrWords2 = {},{},{},{}
	  newarrPositive,newarrNegative,newarrWords1, newarrWords2 = [],[],[],[]
	  for dtc in word['dateCounts']:
		dtcArrPositive[dtc['date']] = dtc['positiveCount']
		dtcArrNegative[dtc['date']] = dtc['negativeCount']
		dtcArrWords1[dtc['date']] = dtc['poswords']
		dtcArrWords2[dtc['date']] = dtc['negwords']
	  temp_date = datetime.strptime(start_dt, "%Y-%m-%d")
	  curdate = temp_date - timedelta(temp_date.weekday())
	  last_date = datetime.strptime(end_dt, "%Y-%m-%d");
	  while curdate < last_date:
	  	strpart = curdate.strftime('%Y-%m-%d')
		newarrPositive.append(dtcArrPositive.get(strpart, 0))
		newarrNegative.append(dtcArrNegative.get(strpart, 0))
		newarrWords1.append(dtcArrWords1.get(strpart, 0))
		newarrWords2.append(dtcArrWords2.get(strpart, 0))
		curdate = curdate + dt1.timedelta(days=7);
	  wordString.append({
			"key": word["word"],
			"Positivevalues": newarrPositive,
			"Negativevalues": newarrNegative,
			"Words1": newarrWords1,
			"Words2": newarrWords2,
			"pcount": word["positiveWordCount"],
			"ncount" : word["negativeWordCount"]
		})
	  return_string["wordjson"]=wordString;
	return simplejson.dumps(return_string);

@mod_data.route('/loadTopics')
def loadTopics():
	#cats = request.args.get('category', '')
	cats = "Shoes"
	db1 = cl["amazon2"]
	return_string = {}
	wordString = []

	topic_list = db1.topic_words.find( { "category" : cats},{"topic":1,"_id" :0} );
	print topic_list
	topic_array, comment_array = [],[]
	for topic in topic_list:
		topic_array.append(topic['topic']);
	comments_list = db1.Shoes.find({},{"text":1,"_id":0}).limit(13);
	for comment in comments_list:
		comment_array.append(comment);
	return_string = {}
	return_string["comments"] = comment_array;
	return_string["topics"] = topic_array;
	return simplejson.dumps(return_string);

@mod_data.route('/loadWords')
def loadWords():
	cats = request.args.get('category', '')
	#cats = "CellAccessories"
	db = cl["amazon2"]
	return_string = {}
	wordString = []
	
	dateRange = db.catkeys.find_one({"category":cats},{'st_dt':1,'end_dt':1, '_id' : 0})
	start_dt =  dateRange['st_dt']
	end_dt =  dateRange['end_dt']

	wordFreq = db.catkeys.find({"category":cats});
	for word in wordFreq:
	  dtcArrPositive,dtcArrNegative,dtcArrWords1, dtcArrWords2 = {},{},{},{}
	  newarrPositive,newarrNegative,newarrWords1, newarrWords2 = [],[],[],[]
	  for dtc in word['dateCounts']:
		dtcArrPositive[dtc['date']] = dtc['positiveCount']
		dtcArrNegative[dtc['date']] = dtc['negativeCount']
		dtcArrWords1[dtc['date']] = dtc['poswords']
		dtcArrWords2[dtc['date']] = dtc['negwords']
	  temp_date = datetime.strptime(start_dt, "%Y-%m-%d")
	  curdate = temp_date - timedelta(temp_date.weekday())
	  last_date = datetime.strptime(end_dt, "%Y-%m-%d");
	  while curdate < last_date:
	  	strpart = curdate.strftime('%Y-%m-%d')
		newarrPositive.append(dtcArrPositive.get(strpart, 0))
		newarrNegative.append(dtcArrNegative.get(strpart, 0))
		newarrWords1.append(dtcArrWords1.get(strpart, 0))
		newarrWords2.append(dtcArrWords2.get(strpart, 0))
		curdate = curdate + dt1.timedelta(days=7);
	  wordString.append({
			"key": word["word"],
			"Positivevalues": newarrPositive,
			"Negativevalues": newarrNegative,
			"Words1": newarrWords1,
			"Words2": newarrWords2,
			"pcount": word["positiveWordCount"],
			"ncount" : word["negativeWordCount"]
		})
	  return_string["wordjson"]=wordString;
	return simplejson.dumps(return_string);


@mod_data.route('/topic1')
def topic_mod1():
	##For creating a new topic
	word = request.args.get('word', '')
	wordjson={}
	wordjson['word'] = word
	wordjson['weight'] = 1
	topic = request.args.get('topic', '')
	cat = request.args.get('category', '')
	db = cl["amazon"]
	db1 = cl["amazon2"]

	v = db1.topic_words.find( {"category" : cat,"topic":topic })
	count = 0;
	for record in v:
		count += 1;
	if (count>0):
		v = db1.topic_words.update( {"category" : cat,"topic":topic } ,{"$addToSet": { "words": wordjson }});
	else:
		word_arr= []
		word_arr.append(wordjson)
		v = db1.topic_words.insert( {"category" : cat,"topic":topic , "words": word_arr});

	v = db1.shoekeys1.update( {"wordlist.word" : word } , {"$addToSet" : {"wordlist.$.topic" : topic} }, upsert=False, multi=True);
	topic_mod5();
	# v = db.catkeys.remove( { "category" : "Shoes" } );
	# result  = db.shoekeys.aggregate([
	# 	  {'$unwind': '$wordlist' },
	# 	  {'$project': { '_id': 0, "category": {'$concat': ["Shoes"]},"st_dt": {'$concat': ["2008-01-01"]}, "end_dt": {'$concat': ["2013-01-01"]},
	# 	  'word1' : {'$cond': { 'if': { '$gte': [ "$score", '4.0' ] }, 'then': "$wordlist.word", 'else': '' }}, 
	# 	  'word2' : {'$cond': { 'if': { '$lte': [ "$score", '3.0' ] }, 'then': "$wordlist.word", 'else': '' }},
	# 	  'wordlist.topic': 1,
	# 	  'date':1, 'dateweek':1, 'score1': {'$cond': { 'if': { '$gte': [ "$score", '4.0' ] }, 'then': 1, 'else': 0 }}, 
	# 	  'score2': {'$cond': { 'if': { '$lte': [ "$score", '3.0' ] }, 'then': 1, 'else': 0 }}
	# 	  } 
	# 	  },
	# 	  { "$group": {
	# 	        "_id": {
	# 	            "wordlist": "$wordlist.topic",
	# 	            "date": "$dateweek"
	# 	        },
	# 	        "positiveCount": { "$sum": "$score1" },
	# 	        "negativeCount": { "$sum": "$score2" },
	# 	        "poswords": { "$addToSet": "$word1" },
	# 	        "negwords": { "$addToSet": "$word2" },
	# 	        "category" : { '$max': "$category" },
	# 	        "st_dt" : { '$max': "$st_dt" },
	# 	        "end_dt" : { '$max': "$end_dt" }
	# 	    }},
	# 	  { "$group": {
	# 	        "_id": "$_id.wordlist",
	# 	        "dateCounts": { 
	# 	            "$push": { 
	# 	                "date": "$_id.date",
	# 	                "poswords": "$poswords",
	# 	                "negwords": "$negwords",
	# 	                "positiveCount": "$positiveCount",
	# 	                "negativeCount": "$negativeCount"
	# 	            },
	# 	        },
	# 	        "category" : { '$max': "$category" },
	# 	        "st_dt" : { '$max': "$st_dt" },
	# 	        "end_dt" : { '$max': "$end_dt" },
	# 	        "positiveWordCount": { "$sum": "$positiveCount" },
	# 	        "negativeWordCount": { "$sum": "$negativeCount" },
	# 	        "totalAmount": { '$sum': { '$add': [ "$positiveCount", "$negativeCount" ] } }
	# 	    }},
	# 	    {'$project': { '_id':0, 'word': "$_id", 'dateCounts': 1, 'category' : 1, 'st_dt' : 1, 'end_dt' : 1, 'totalAmount':1, 'positiveWordCount':1, "negativeWordCount":1 }},
	# 	    {'$sort': { 'totalAmount': -1 } },
	# 	  { '$limit': 50 }
	# 	 ])
	
	# v = db.catkeys.insert(result['result']);
	return "hello";
@mod_data.route('/topic2')
def topic_mod2():
	##For renaming an existing topic
	cats = request.args.get('category', '')
	old_topic = request.args.get('oldtopic', '')
	new_topic = request.args.get('newtopic', '')
	print cats
	print old_topic
	print new_topic
	db = cl["amazon2"]

	v = db.shoekeys1.update( {"wordlist.topic" :old_topic},{"$set" : {"wordlist.$.topic" : new_topic}},upsert=False, multi=True);

	v = db.topic_words.update( {"category" : cats, "topic":old_topic },{'$set' : {"topic":new_topic}},upsert=False, multi=True);

	return "hello"
@mod_data.route('/topic3')
def topic_mod3():
	##For removing an existing topic
	cats = request.args.get('category', '')
	old_topic = request.args.get('oldtopic', '')
	db = cl["amazon2"]
	# v = db.shoekeys1.update( {"wordlist.topic" : old_topic } , {"$pull" : {"wordlist.$.topic" : old_topic} }, upsert=False, multi=True);
	v = db.shoekeys1.update( {"wordlist.topic" :old_topic},{"$set" : {"wordlist.$.topic" : "dummy"}},upsert=False, multi=True);
	v = db.topic_words.remove( {"category" : cats, "topic":old_topic });
	return "hello"

@mod_data.route('/topic4')
def topic_mod4():
	##For fetching words from topics
	db = cl["amazon2"]
	results = db.topic_words.find({},{"_id":0});
	result_set=[];
	for record in results:
		result_set.append(record);
	return simplejson.dumps(result_set);

@mod_data.route('/topic5')
def topic_mod5():
	##For fetching words from topics
	parser = OptionParser()
	parser.add_option("--alpha", dest="alpha", type="float", help="parameter alpha", default=0.001)
	parser.add_option("--beta", dest="beta", type="float", help="parameter beta", default=0.001)
	parser.add_option("-k", dest="K", type="int", help="number of topics", default=50)
	parser.add_option("-i", dest="iteration", type="int", help="iteration count", default=100)
	parser.add_option("-s", dest="seed", type="int", help="random seed", default=None)
	parser.add_option("-n", dest="samplesize", type="int", help="dataset sample size", default=100)
	(options, args) = parser.parse_args()
	random.seed(options.seed)
	numpy.random.seed(options.seed)
	
	idlist = random.sample(reuters.fileids(), options.samplesize)

	labels = []
	corpus = []
	labelset = []

	db = cl["amazon2"]
	results = db.topic_words.find({"category":"Shoes"},{"_id":0, "category":0});
	result_set=[];
	for record in results:
		topicset = []
		topicset.append(record["topic"])
		labels.append(topicset)
		labelset.append(record["topic"])
		wordlist = []
		for wordjson in record["words"]:
			wordlist.append(wordjson['word'])
		print wordlist
		corpus.append([x.lower() for x in wordlist if x!='' and (x[0] in string.ascii_letters)])	

	llda = LLDA(options.K, options.alpha, options.beta)
	llda.set_corpus(labelset, corpus, labels)

	# print "M=%d, V=%d, L=%d, K=%d" % (len(corpus), len(llda.vocas), len(labelset), options.K)

	for i in range(options.iteration):
	    sys.stderr.write("-- %d : %.4f\n" % (i, llda.perplexity()))
	    llda.inference()
	print "perplexity : %.4f" % llda.perplexity()

	phi = llda.phi()
	results = db.topic_words.drop();
	for k, label in enumerate(labelset):
	    print "\n-- label %d : %s" % (k, label)
	    wordlist = []
	    for w in numpy.argsort(-phi[k])[:20]:
	    	wordjson = {}
	    	print "%s: %.4f" % (llda.vocas[w], phi[k,w])
	    	wordjson['word'] = llda.vocas[w]
	    	wordjson['weight'] = phi[k,w]
	        wordlist.append(wordjson)
	        v = db.shoekeys1.update( {"wordlist.word" : llda.vocas[w] } , 
                {"$addToSet" : {"wordlist.$.topic" : label} }, upsert=False, multi=True);
	    if (label!= "common"):
	    	db.topic_words.insert({"category":"Shoes", "topic":label, "words" : wordlist })
	# return "hello";

@mod_data.route('/topic6')
def topic_mod6():
	## for creating a new topic
	topic = request.args.get('topic', '')
	cat = request.args.get('category', '')
	db = cl["amazon2"]

	v = db.topic_words.find( {"category" : cat,"topic":topic })
	count = 0;
	for record in v:
		count += 1;
	if (count==0):
		word_arr= []
		v = db.topic_words.insert( {"category" : cat,"topic":topic , "words": word_arr});
	return "hello"

@mod_data.route('/topic7')
def topic_mod7():
	## for deleting words from topics
	topics = request.args.get('topics', '')
	cat = request.args.get('category', '')
	words = request.args.get('words', '')

	db = cl["amazon2"]

	wordList = words.split(",")
	topicList = topics.split(",")

	for word in wordList:
		for topic in topicList:
			v = db.shoekeys1.update( {"wordlist.word" : word } , {"$pull" : {"wordlist.$.topic" : topic } }, upsert=False, multi=True);
			v = db.topic_words.update({"topic":topic},{"$pull" : {"words" : { "word": word } } })
	return "hello"

@mod_data.route('/topic8')
def topic_mod8():
	## For retrieving products
	topics = request.args.get('topics', '')
	cat = request.args.get('category', '')
	topicList = topics.split(",")
	wordList = "";
	db = cl["amazon2"]
	for topic in topicList:
		v = db.topic_words.find( {"category" : cat,"topic":topic },{"words":1, "_id":0})
		for value in v:
			for word in value['words']:
				wordList = wordList+word['word']+" "
	print wordList;
	wordList = wordList.rstrip()
	print "hello"
	result = db.Shoes.aggregate(
	   [
	   	 { '$match': { '$text': { '$search': wordList } , 'price': { '$ne': "unknown" } } },   	 
	     {
	       '$group':
	         {
	           '_id': "$productId",
	           'score': { '$avg': "$score" },
	           "title" : { '$max': "$title" },
	           "price" : { '$max': "$price" }
	         }
	     },
	     {'$sort': { 'score': -1 } },
	     { '$limit': 10 },
	     {'$project': { '_id': 1, 'score': 1, 'title':1, 'price':1} }	     
	   ]
	)
	return simplejson.dumps(result['result']);
