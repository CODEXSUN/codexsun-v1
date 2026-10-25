ARG CODEXSUN_FRAPPE_BASE_IMAGE
FROM ${CODEXSUN_FRAPPE_BASE_IMAGE}
USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends supervisor \
    && rm -rf /var/lib/apt/lists/*
COPY --chown=frappe:0 supervisord.conf /opt/codexsun/supervisord.conf
COPY --chown=frappe:0 init_frappe.py healthcheck.py /opt/codexsun/
USER frappe
CMD ["/usr/bin/supervisord", "-c", "/opt/codexsun/supervisord.conf"]
