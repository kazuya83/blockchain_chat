# パッケージ（= マイクロサービス）ごとに、自分の database へ
# tables → master → seed の順で流す。
# seed は master の id を FK で参照するので、順序を入れ替えないこと。
for conf in /var/app/*/database.conf; do
  [ -e "$conf" ] || continue
  PACKAGE_DIR="$(dirname "$conf")"
  DATABASE_NAME=""
  . "$conf"

  if [ -f "${PACKAGE_DIR}/migration.sql" ]; then
    echo "migrate $DATABASE_NAME"
    mysql -h localhost -u root -P 3306 "${DATABASE_NAME}" < "${PACKAGE_DIR}/migration.sql"
  fi

  for kind in master seed; do
    [ -d "${PACKAGE_DIR}/sql/${kind}" ] || continue

    echo "${kind} ${DATABASE_NAME}"
    find "${PACKAGE_DIR}/sql/${kind}" -name '*.sql' | sort | while read -r f; do
      echo "  - ${f}"
      mysql -h localhost -u root -P 3306 "${DATABASE_NAME}" < "${f}"
    done
  done
done
