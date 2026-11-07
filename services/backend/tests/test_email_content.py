"""Correspondence feed helpers: quote split, robot letters, refusal, doc type."""

from email import message_from_string

import pytest

from backend.utils.email_content import (
    DocType,
    MessageKind,
    classify_attachment,
    classify_message,
    looks_like_decline,
    split_quoted_reply,
)

# ---------------------------------------------------------------- quotes


class TestSplitQuotedReply:
    def test_plain_letter_is_kept(self):
        r = split_quoted_reply("Добрый день!\nКП во вложении.")
        assert r.main == "Добрый день!\nКП во вложении."
        assert r.quoted == ""

    @pytest.mark.parametrize("body", [None, "", "   "])
    def test_empty(self, body):
        r = split_quoted_reply(body)
        assert r.main == "" and r.quoted == ""

    def test_original_message(self):
        r = split_quoted_reply(
            "Цена снижена.\n\n-----Original Message-----\nFrom: Вы\nтекст"
        )
        assert r.main == "Цена снижена."
        assert r.quoted.startswith("-----Original Message-----")

    def test_russian_forward_separator(self):
        r = split_quoted_reply(
            "Смотрите ниже.\n-------- Пересылаемое сообщение --------\nтекст"
        )
        assert r.main == "Смотрите ниже."

    def test_gmail_ru_attribution(self):
        r = split_quoted_reply(
            "Готовы на 10 дней.\n\nпн, 3 нояб. 2026 г. в 10:05, Закупки "
            "<buy@company.ru>:\n> Просим КП"
        )
        assert r.main == "Готовы на 10 дней."
        assert "Просим КП" in r.quoted

    def test_wrote_line(self):
        r = split_quoted_reply(
            "OK.\nOn Mon, Nov 3, 2026 at 10:05 AM Buyer <b@x.com> wrote:\n> hi"
        )
        assert r.main == "OK."

    def test_pishet_line(self):
        r = split_quoted_reply(
            "Да.\n03.11.2026 10:05, Иван Петров пишет:\nвопрос"
        )
        assert r.main == "Да."

    def test_outlook_header_block(self):
        r = split_quoted_reply(
            "Спасибо.\n\nОт: Закупки <b@x.ru>\nОтправлено: 3 ноября 2026 г.\n"
            "Кому: s@y.ru\nТема: КП"
        )
        assert r.main == "Спасибо."
        assert r.quoted.startswith("От: Закупки")

    def test_outlook_underscore_rule(self):
        r = split_quoted_reply(
            "Ок.\n________________________________\nFrom: Buyer\nSent: Monday"
        )
        assert r.main == "Ок."

    @pytest.mark.parametrize(
        "body",
        [
            "Поставка от: 10 дней\nОплата 50/50",
            "От: склада в Минске\nСрок 5 дней",
        ],
    )
    def test_lone_from_line_is_text(self, body):
        assert split_quoted_reply(body).quoted == ""

    def test_trailing_gt_block(self):
        r = split_quoted_reply("Принято.\n\n> Просим КП\n> на кабель\n")
        assert r.main == "Принято."
        assert r.quoted == "> Просим КП\n> на кабель"

    def test_gt_in_the_middle_is_text(self):
        assert split_quoted_reply("> ваш вопрос\nНаш ответ: да.").quoted == ""

    def test_pure_forward_is_kept_whole(self):
        text = "-----Original Message-----\nFrom: A\nтекст"
        r = split_quoted_reply(text)
        assert r.main == text and r.quoted == ""

    def test_crlf(self):
        r = split_quoted_reply(
            "Да.\r\n\r\n-----Original Message-----\r\nтекст"
        )
        assert r.main == "Да."

    def test_earliest_marker_wins(self):
        r = split_quoted_reply(
            "Новое.\n-----Original Message-----\nстарое\n"
            "-----Original Message-----\nещё старее"
        )
        assert r.main == "Новое."
        assert "ещё старее" in r.quoted


# ---------------------------------------------------------------- robots


def _mime(raw: str):
    return message_from_string(raw.strip() + "\n")


DSN_FAILED = """
From: Mail Delivery System <MAILER-DAEMON@mx.example.com>
To: buy@company.example.com
Subject: Undelivered Mail Returned to Sender
Content-Type: multipart/report; report-type=delivery-status; boundary="b"
MIME-Version: 1.0

--b
Content-Type: text/plain

This is the mail system. Your message could not be delivered.

--b
Content-Type: message/delivery-status

Reporting-MTA: dns; mx.example.com

Final-Recipient: rfc822; snab@kovalev.example.com
Action: failed
Status: 5.1.1

--b--
"""

DSN_DELAYED = DSN_FAILED.replace("Action: failed", "Action: delayed").replace(
    "Undelivered Mail Returned to Sender", "Delayed Mail (still being retried)"
)


class TestClassifyMessage:
    def test_ordinary_reply(self):
        msg = _mime("From: a@b.ru\nSubject: Re: КП\n\nтекст")
        assert (
            classify_message(
                subject="Re: КП", from_email="a@b.ru", headers=msg
            )
            is None
        )

    def test_dsn_report_failed(self):
        msg = _mime(DSN_FAILED)
        assert (
            classify_message(
                subject="Undelivered Mail Returned to Sender",
                from_email="mailer-daemon@mx.example.com",
                headers=msg,
            )
            == MessageKind.BOUNCE
        )

    def test_dsn_report_without_daemon_sender(self):
        msg = _mime(
            DSN_FAILED.replace(
                "MAILER-DAEMON@mx.example.com", "noreply@mx.example.com"
            )
        )
        assert (
            classify_message(
                subject="x", from_email="noreply@mx.example.com", headers=msg
            )
            == MessageKind.BOUNCE
        )

    def test_dsn_delayed_is_not_a_failure(self):
        msg = _mime(DSN_DELAYED)
        assert (
            classify_message(
                subject="Delayed Mail",
                from_email="mailer-daemon@mx.example.com",
                headers=msg,
            )
            == MessageKind.AUTO_REPLY
        )

    def test_daemon_sender_with_bounce_subject_without_report(self):
        assert (
            classify_message(
                subject="Mail delivery failed: returning message to sender",
                from_email="Mailer-Daemon@host.example.com",
            )
            == MessageKind.BOUNCE
        )

    def test_russian_bounce_subject(self):
        assert (
            classify_message(
                subject="Недоставленное сообщение",
                from_email="postmaster@mail.example.ru",
            )
            == MessageKind.BOUNCE
        )

    def test_daemon_other_notice_is_robot_not_failure(self):
        assert (
            classify_message(
                subject="Mailbox quota warning", from_email="postmaster@x.ru"
            )
            == MessageKind.AUTO_REPLY
        )

    def test_bounce_subject_from_a_person_is_a_reply(self):
        # a supplier quoting "не доставлено" in a normal letter
        assert (
            classify_message(
                subject="Re: письмо не доставлено?", from_email="ivan@x.ru"
            )
            is None
        )

    @pytest.mark.parametrize(
        "header",
        [
            "Auto-Submitted: auto-replied",
            "X-Autoreply: yes",
            "Precedence: auto_reply",
        ],
    )
    def test_auto_reply_headers(self, header):
        msg = _mime(f"From: a@b.ru\nSubject: Re: КП\n{header}\n\nВ отпуске")
        assert (
            classify_message(
                subject="Re: КП", from_email="a@b.ru", headers=msg
            )
            == MessageKind.AUTO_REPLY
        )

    def test_auto_submitted_no_is_a_reply(self):
        msg = _mime(
            "From: a@b.ru\nSubject: Re: КП\nAuto-Submitted: no\n\nтекст"
        )
        assert (
            classify_message(
                subject="Re: КП", from_email="a@b.ru", headers=msg
            )
            is None
        )

    @pytest.mark.parametrize(
        "subject",
        [
            "Автоответ: Re: Запрос КП",
            "Automatic reply: RFQ",
            "Out of Office: RFQ",
            "AutoReply: x",
        ],
    )
    def test_auto_reply_subjects(self, subject):
        assert (
            classify_message(subject=subject, from_email="a@b.ru")
            == MessageKind.AUTO_REPLY
        )

    def test_auto_word_inside_subject_is_a_reply(self):
        assert (
            classify_message(
                subject="Re: КП, вопрос про автоответчик", from_email="a@b.ru"
            )
            is None
        )

    def test_no_data(self):
        assert classify_message(subject=None, from_email=None) is None


# ---------------------------------------------------------------- refusal


class TestLooksLikeDecline:
    @pytest.mark.parametrize(
        "text",
        [
            "Добрый день. К сожалению, нужной марки нет в наличии до января.",
            "Не можем предложить данную позицию.",
            "Вынуждены отказаться от участия.",
            "Мы не занимаемся кабельной продукцией.",
            "Unfortunately we are unable to quote.",
            "Данную продукцию не поставляем.",
        ],
    )
    def test_refusals(self, text):
        assert looks_like_decline(text)

    @pytest.mark.parametrize(
        "text",
        [
            "Нет в наличии, но можем привезти под заказ за 3 недели.",
            "Нет в наличии, предлагаем аналог ВВГнг-LS.",
            "Нет в наличии, цена 98 руб./м, срок поставки 14 дней.",
            "Направляем КП на 1 240 000 руб.",
            "",
            None,
        ],
    )
    def test_not_refusals(self, text):
        assert not looks_like_decline(text)


# ---------------------------------------------------------------- doc type


class TestClassifyAttachment:
    @pytest.mark.parametrize(
        ("name", "expected"),
        [
            ("КП_418_ЭлектроКомплект.pdf", DocType.OFFER),
            (
                "КП_418_v2_ЭлектроКомплект_обновлённое_предложение.pdf",
                DocType.OFFER,
            ),
            ("Коммерческое предложение.docx", DocType.OFFER),
            ("quotation-2026-11.pdf", DocType.OFFER),
            ("Прайс_кабель_ноябрь_2026.xlsx", DocType.PRICE),
            ("price-list.xls", DocType.PRICE),
            ("Сертификат_ПБ_ВВГнг-LS.pdf", DocType.CERTIFICATE),
            ("Декларация ЕАЭС.pdf", DocType.CERTIFICATE),
            ("Счет №15 от 06.11.pdf", DocType.INVOICE),
            ("Счёт на оплату.pdf", DocType.INVOICE),
            ("Договор поставки.docx", DocType.CONTRACT),
            ("Карточка_предприятия.pdf", DocType.COMPANY_CARD),
            ("Реквизиты ООО.docx", DocType.COMPANY_CARD),
            ("ТЗ_кабель_ВВГнг-LS.docx", DocType.TECH_SPEC),
            ("Фото_барабана.jpg", DocType.IMAGE),
            ("scan0001.pdf", DocType.OTHER),
            ("", DocType.OTHER),
            (None, DocType.OTHER),
        ],
    )
    def test_names(self, name, expected):
        assert classify_attachment(name) == expected

    def test_image_by_content_type(self):
        assert (
            classify_attachment("inline_image", "image/png") == DocType.IMAGE
        )

    def test_kp_inside_a_word_is_not_an_offer(self):
        # "кпд" (efficiency) is not "КП"
        assert (
            classify_attachment("Таблица КПД двигателей.pdf") == DocType.OTHER
        )
