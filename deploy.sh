
ssh ovh 'cd /var/django/spritzreader; git pull'
scp config.py ovh:/var/django/spritzreader/
ssh ovh '/etc/init.d/apache2 restart'

