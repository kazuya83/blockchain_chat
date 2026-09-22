if [ "$MYSQL_USER" != "root" ]; then
  echo "CREATE USER '"$MYSQL_USER"'@'%' IDENTIFIED BY '';" | "${mysql[@]}"
fi

# パッケージ（= マイクロサービス）ごとに 1 database。
# database.conf を置いたパッケージだけが対象で、中身がまだ無いパッケージは飛ばす。
for conf in /var/app/*/database.conf; do
  [ -e "$conf" ] || continue
  DATABASE_NAME=""
  . "$conf"

  echo "CREATE DATABASE IF NOT EXISTS \`${DATABASE_NAME}\` ;" | "${mysql[@]}"
  echo "GRANT ALL ON \`${DATABASE_NAME}\`.* TO '"$MYSQL_USER"'@'%' ;" | "${mysql[@]}"
done

echo "FLUSH PRIVILEGES ;" | "${mysql[@]}"
echo "SHOW DATABASES ;" | "${mysql[@]}"
