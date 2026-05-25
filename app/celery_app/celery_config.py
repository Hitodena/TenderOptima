import asyncio

from celery import Celery
from celery.schedules import crontab
from celery.signals import worker_process_init, worker_process_shutdown
from kombu import Exchange, Queue

from app.celery_app.context import WorkerContext
from app.core import get_config

config = get_config()


app = Celery("tenderoptima")
app.config_from_object("app.celery_app.celery_config:CeleryConfig")


@worker_process_init.connect
def init_worker(**kwargs):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    loop.run_until_complete(WorkerContext.init())


@worker_process_shutdown.connect
def shutdown_worker(**kwargs):
    context = WorkerContext._instance
    if context:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        loop.run_until_complete(context.cleanup())


class CeleryConfig:
    # Broker & Backend
    broker_url = (
        f"redis://:{config.redis_password}@{config.redis_host}"
        f":{config.redis_port}/0"
    )
    result_backend = (
        f"redis://:{config.redis_password}@{config.redis_host}"
        f":{config.redis_port}/1"
    )
    broker_connection_retry_on_startup = True
    broker_connection_retry = True
    broker_connection_max_retries = 3

    # Serialization
    task_serializer = "json"
    result_serializer = "json"
    accept_content = ["json"]

    # Time
    timezone = "UTC"
    enable_utc = True

    # Worker
    worker_pool = "prefork"
    worker_concurrency = 5
    worker_prefetch_multiplier = 1
    worker_max_tasks_per_child = 500
    worker_disable_rate_limits = False

    # Task execution
    task_acks_late = True
    task_reject_on_worker_lost = True
    task_ignore_result = False
    task_track_started = True

    # Timeouts
    task_soft_time_limit = 240
    task_time_limit = 300

    # Result backend
    result_expires = 3600
    result_backend_transport_options = {"retry_policy": {"timeout": 5.0}}

    # Priority
    broker_transport_options = {
        "queue_order_strategy": "priority",
        "priority_steps": list(range(10)),
        "sep": ":",
        "visibility_timeout": 3600,
    }
    task_default_priority = 0

    mail_exchange = Exchange("mail", type="direct", durable=True)
    parser_exchange = Exchange("parser", type="direct", durable=True)

    task_queues = (
        Queue(
            "mail_send",
            mail_exchange,
            routing_key="mail.send",
            priority=8,
        ),
        Queue(
            "mail_poll",
            mail_exchange,
            routing_key="mail.poll",
            priority=5,
        ),
        Queue(
            "mail_reply",
            mail_exchange,
            routing_key="mail.reply",
            priority=7,
        ),
        Queue(
            "parser_search",
            parser_exchange,
            routing_key="parser.search",
            priority=3,
        ),
    )

    # Routing
    task_routes = {
        "mail.send": {
            "queue": "mail_send",
            "routing_key": "mail.send",
        },
        "mail.poll": {
            "queue": "mail_poll",
            "routing_key": "mail.poll",
        },
        "mail.reply": {
            "queue": "mail_reply",
            "routing_key": "mail.reply",
        },
        "parser.search": {
            "queue": "parser_search",
            "routing_key": "parser.search",
        },
    }

    include = [
        "app.celery_app.tasks.email_tasks",
        "app.celery_app.tasks.parser_tasks",
    ]

    # Logging
    worker_log_format = (
        "[%(asctime)s: %(levelname)s/%(processName)s] %(message)s"
    )
    worker_task_log_format = (
        "[%(asctime)s: %(levelname)s/%(processName)s]"
        " [%(task_name)s/%(task_id)s] %(message)s"
    )

    # Events
    worker_send_task_events = True
    task_send_sent_event = True

    # Beat schedule
    beat_schedule = {
        "poll-imap": {
            "task": "mail.poll",
            "schedule": crontab(minute="*/1"),
            "args": (),
            "options": {"queue": "mail_poll", "expires": 600},
        },
    }
