ARG CODEXSUN_FRAPPE_BASE_IMAGE
FROM ${CODEXSUN_FRAPPE_BASE_IMAGE}
USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends supervisor \
    && rm -rf /var/lib/apt/lists/*
RUN python -c 'from pathlib import Path; p=Path("/templates/nginx/frappe.conf.template"); s=p.read_text(); old="proxy_set_header Origin $proxy_x_forwarded_proto://${FRAPPE_SITE_NAME_HEADER};"; assert s.count(old)==1; p.write_text(s.replace(old,"proxy_set_header Origin $http_origin;"))'
COPY --chown=frappe:0 supervisord.conf /opt/codexsun/supervisord.conf
COPY --chown=frappe:0 init_frappe.py healthcheck.py /opt/codexsun/
USER frappe
CMD ["/usr/bin/supervisord", "-c", "/opt/codexsun/supervisord.conf"]
