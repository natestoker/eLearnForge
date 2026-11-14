# Moodle check (a real LMS)

Publishes the demo course as SCORM 1.2 and SCORM 2004, uploads each to a local
Moodle, plays it in a browser (wrong answer, retry, finish), and lets you read
what Moodle stored. Not part of `npm test` or CI: it needs Docker and a few
minutes for Moodle to start.

```bash
docker network create lms
docker run -d --name moodledb --network lms -e ALLOW_EMPTY_PASSWORD=yes -e MARIADB_USER=moodle -e MARIADB_PASSWORD=moodlepw -e MARIADB_DATABASE=moodle -e MARIADB_CHARACTER_SET=utf8mb4 -e MARIADB_COLLATE=utf8mb4_unicode_ci bitnamilegacy/mariadb:11.4
docker run -d --name moodle --network lms -p 127.0.0.1:8081:8080 -e MOODLE_DATABASE_TYPE=mariadb -e MOODLE_DATABASE_HOST=moodledb -e MOODLE_DATABASE_USER=moodle -e MOODLE_DATABASE_PASSWORD=moodlepw -e MOODLE_DATABASE_NAME=moodle -e MOODLE_USERNAME=admin -e MOODLE_PASSWORD='Admin#12345pw' -e MOODLE_EMAIL=a@example.com -e MOODLE_HOST=127.0.0.1:8081 bitnamilegacy/moodle:4.5
```

Wait about two minutes, then (the scripts log in as `admin` / `Elfpass-9876xyz`, so set that):

```bash
docker exec moodle bash -c "cd /bitnami/moodle && php admin/cli/reset_password.php --username=admin --password='Elfpass-9876xyz'"
npm run build
mkdir -p /tmp/pk && node tests/lms-moodle/make-package.mjs /tmp/pk scorm12 && node tests/lms-moodle/make-package.mjs /tmp/pk scorm2004
node tests/lms-moodle/add-activity.mjs 2 /tmp/pk/scorm12.zip "SCORM 1.2" /tmp/a.png     # course id 2 must exist: create one in the UI first
node tests/lms-moodle/play.mjs 2 /tmp/p.png                                              # 2 = the activity's cm id
docker exec moodledb /opt/bitnami/mariadb/bin/mariadb -umoodle -pmoodlepw moodle -e "select e.element, v.value from mdl_scorm_scoes_value v join mdl_scorm_element e on e.id=v.elementid order by v.id"
```
