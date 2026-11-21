import os

class Config:
    # Se lee de la variable de entorno DATABASE_URL (ver src/.env.example)
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "postgresql://usuario:contrasena@localhost:5432/coproda"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_AS_ASCII = False  # para soportar bien acentos en JSON
    SECRET_KEY = os.getenv("SECRET_KEY", "dev_secret_key")
    URL_PREFIX = "/coproda"
