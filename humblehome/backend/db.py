from flask import g
import mysql.connector
from dotenv import load_dotenv
import os

load_dotenv()
# This file is for connecting to the database.


def get_db():
    if "db" not in g:
        g.db = mysql.connector.connect(
            host=os.getenv("DB_HOST"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_DATABASE"),
        )
    return g.db


def close_db(err):
    db = g.pop("db", None)
    if db:
        db.close()
