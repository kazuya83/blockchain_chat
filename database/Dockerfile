FROM mysql:8.0

WORKDIR /var/app

COPY build/docker-entrypoint-initdb.d/* /docker-entrypoint-initdb.d/
COPY build/my.cnf /etc/mysql/my.cnf
COPY chat/ chat/

ENV MYSQL_ROOT_HOST=% \
	MYSQL_ALLOW_EMPTY_PASSWORD=true \
	MYSQL_DATABASE=testing

# パッケージごとに sql/tables を 1 ファイルへまとめる。
# テーブル定義は FK を前方参照するので、流す間だけ検査を外す。
RUN for pkg in */ ; do \
		[ -d "${pkg}sql/tables" ] || continue; \
		{ \
			echo "SET FOREIGN_KEY_CHECKS = 0;"; \
			find "${pkg}sql/tables" -name '*.sql' | sort | xargs -r cat; \
			echo "SET FOREIGN_KEY_CHECKS = 1;"; \
		} > "${pkg}migration.sql"; \
	done

EXPOSE 3306 33060
