import pytest

from schoolscraper.crypto import Vault
from schoolscraper.users import UserStore, validate_name


def test_validate_name_ok():
    assert validate_name("Bob") == "bob"
    assert validate_name("alice_2") == "alice_2"


def test_validate_name_rejects_bad():
    with pytest.raises(ValueError):
        validate_name("")
    with pytest.raises(ValueError):
        validate_name("1bob")
    with pytest.raises(ValueError):
        validate_name("has space")


def test_vault_round_trip():
    v = Vault("test-master-key-please-rotate")
    cipher = v.encrypt("hunter2")
    assert cipher and cipher != "hunter2"
    assert v.decrypt(cipher) == "hunter2"


def test_vault_empty():
    v = Vault("k")
    assert v.encrypt("") == ""
    assert v.decrypt("") == ""


def test_vault_wrong_key_fails():
    v1 = Vault("key-one")
    v2 = Vault("key-two")
    cipher = v1.encrypt("secret")
    with pytest.raises(RuntimeError):
        v2.decrypt(cipher)


def test_user_store_round_trip(tmp_path):
    db = tmp_path / "users.db"
    vault = Vault("k")
    store = UserStore(str(db), vault)
    store.upsert(
        name="Bob",
        display_name="Bob",
        schoology_consumer_key="ckey",
        schoology_consumer_secret="csecret",
        powerschool_url="https://ps.example.org/public/",
        powerschool_username="bob",
        powerschool_password="pw",
    )
    users = store.list()
    assert len(users) == 1
    bob = users[0]
    assert bob.name == "bob"
    assert bob.schoology_consumer_secret == "csecret"
    assert bob.powerschool_password == "pw"
    assert bob.schoology_config().configured
    assert bob.powerschool_config().configured


def test_user_store_remove(tmp_path):
    store = UserStore(str(tmp_path / "u.db"), Vault("k"))
    store.upsert(name="bob", display_name="Bob")
    assert store.remove("bob") is True
    assert store.remove("bob") is False
    assert store.list() == []
