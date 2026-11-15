"""Tests for the daily live deploy's decisions (no git, npm or Cloudflare needed).   python -m pytest tools -q"""
from pathlib import Path

import deploy_live

LATEST = {"games": 18409, "updated": "2026-11-15T09:03+00:00",
          "files": {"games": "games.20261115-090318.json", "tags": "tags.20261115-090318.json",
                    "tag_weights": "tag_weights.20261115-090318.f32", "prices": "prices.20261115-090318.json"}}


def test_fresh_files_are_latest_and_what_it_names():
    assert deploy_live.fresh_files(LATEST) == ["latest.json", "games.20261115-090318.json", "prices.20261115-090318.json",
                                               "tag_weights.20261115-090318.f32", "tags.20261115-090318.json"]


def test_fresh_files_without_a_files_list():
    assert deploy_live.fresh_files({"games": 1}) == ["latest.json"]


def test_stale_data_is_only_the_daily_files():
    names = ["games.json", "nbr_idx.u16", "latest.json", "games.20261114-190847.json", "prices.20261114-190847.json.tmp"]
    assert deploy_live.stale_data(names) == ["games.20261114-190847.json", "latest.json", "prices.20261114-190847.json.tmp"]


def test_plan_installs_then_builds_and_deploys_the_live_copy():
    live = Path("C:/x/anything-scout-live")
    steps = deploy_live.plan(live, install=["web", "worker"])
    cwd, cmd = steps[-1]
    assert cwd == live / "worker" and cmd[-2:] == ["run", "deploy:golive"], "last: the OK'd deploy command, in the live copy"
    installs = [i for i, (c, cmd) in enumerate(steps) if cmd[-1] == "ci"]
    assert [steps[i][0] for i in installs] == [live / "web", live / "worker"]
    assert max(installs) < len(steps) - 1


def test_plan_skips_installs_that_are_up_to_date():
    steps = deploy_live.plan(Path("C:/x/live"), install=[])
    assert [cmd[-1] for _, cmd in steps] == ["deploy:golive"]


def test_nothing_new_means_no_deploy():
    stamp = deploy_live.stamp("abc123", LATEST)
    assert deploy_live.stamp("abc123", LATEST) == stamp
    assert deploy_live.stamp("def456", LATEST) != stamp, "a new live version deploys"
    assert deploy_live.stamp("abc123", {**LATEST, "updated": "2026-11-16T04:05+00:00"}) != stamp, "new prices deploy"
