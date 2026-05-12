from pathlib import Path

import polars as pl

from engine.analytics import cultural_signal_network_evidence, graph_engine_capabilities, historical_memory_evidence, knowledge_search_evidence, market_signal_evidence, portfolio_evidence
from agent.tools import analyze_cultural_signal_network, get_market_signal_evidence, query_historical_memory, search_living_knowledge, synthesize_evidence
from engine.data_generator import build_cultural_graph_edges, generate_scripts
from engine.market_ingestion import run as run_market_ingestion
from engine.visuals import accelerated_visual_capabilities, stand_up_cuxfilter_server, workspace_payload


def test_generate_scripts_is_polars_dataframe() -> None:
    signals = pl.DataFrame(
        {
            "signal_id": ["spotify_00001"],
            "signal_name": ["Ordinary - Alex Warren"],
            "signal_category": ["music_trend"],
            "country": ["GLOBAL"],
            "snapshot_date": ["2025-06-11"],
            "trend_strength": [0.91],
            "trend_delta": [0.02],
            "confidence": [0.92],
            "source_name": ["Spotify Daily Top 200 Kaggle Mirror"],
            "source_url": ["https://www.kaggle.com/datasets/asaniczka/top-spotify-songs-in-73-countries-daily-updated"],
        }
    )

    df = generate_scripts(rows=25, seed=7, spotify_signals=signals)

    assert isinstance(df, pl.DataFrame)
    assert df.height == 25
    assert "script_id" in df.columns
    assert "music_momentum_score" in df.columns
    assert "audience_behavior_score" in df.columns
    assert "audience_profile_id" in df.columns
    assert Path("data").name == "data"


def test_build_cultural_graph_edges_from_cmu_fixture(tmp_path: Path) -> None:
    cmu_dir = tmp_path / "cmu"
    out_dir = tmp_path / "out"
    cmu_dir.mkdir()
    (cmu_dir / "movie.metadata.tsv").write_text(
        '1\t/m/movie\tFixture Movie\t2001\t\t90\t{"/m/lang": "English Language"}\t'
        '{"/m/country": "United States of America"}\t{"/m/genre": "Drama"}\n'
    )
    (cmu_dir / "character.metadata.tsv").write_text(
        "1\t/m/movie\t2001\tLead\t1970\tF\t1.7\t\tActor Name\t31\t/m/map\t/m/char\t/m/actor\n"
    )
    (cmu_dir / "tvtropes.clusters.txt").write_text(
        'mentor\t{"char": "Lead", "movie": "Fixture Movie", "id": "/m/map", "actor": "Actor Name"}\n'
    )
    scripts = pl.DataFrame(
        {
            "script_id": ["script_000001"],
            "cultural_signal_ids": [["spotify_00001", "spotify_00002"]],
            "music_momentum_score": [0.82],
        }
    )

    edges = build_cultural_graph_edges(scripts=scripts, cmu_dir=cmu_dir, out_dir=out_dir)

    assert edges.height == 8
    assert (out_dir / "cultural_graph_edges.parquet").exists()
    assert set(edges["edge_type"]) == {
        "script_cultural_signal",
        "movie_genre",
        "movie_country",
        "movie_language",
        "movie_character",
        "character_actor",
        "character_trope",
    }


def test_portfolio_evidence_and_synthesis_are_structured(tmp_path: Path) -> None:
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    pl.DataFrame(
        {
            "script_id": ["script_000001", "script_000002"],
            "title": ["First", "Second"],
            "genre_primary": ["Drama", "Comedy"],
            "platform_fit": ["Streaming", "FAST"],
            "target_demo": ["Gen Z", "Millennial"],
            "market": ["Global", "United States"],
            "viability_score": [0.9, 0.5],
            "completion_prediction": [0.8, 0.4],
            "cultural_risk_score": [0.2, 0.6],
            "risk_category": ["LOW", "ELEVATED"],
            "music_momentum_score": [0.7, 0.6],
        }
    ).write_parquet(data_dir / "scripts_150k.parquet")

    evidence = portfolio_evidence(data_dir=data_dir, limit=1)
    brief = synthesize_evidence(evidence, role="executive")

    assert evidence["evidence_type"] == "portfolio_summary"
    assert evidence["summary"]["records"] == 2
    assert evidence["benchmark"]["compute_source"] in {
        "High-Performance Compute Cluster",
        "Standard Edge Node",
    }
    assert brief["role"] == "executive"
    assert len(brief["recommended_candidates"]) == 1


def test_historical_memory_finds_lookalike_projects(tmp_path: Path) -> None:
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    pl.DataFrame(
        {
            "script_id": ["script_000001", "script_000002", "script_000003"],
            "title": ["Seed", "Lookalike", "Different"],
            "genre_primary": ["Drama", "Drama", "Comedy"],
            "platform_fit": ["Streaming", "Streaming", "FAST"],
            "target_demo": ["Gen Z", "Gen Z", "Millennial"],
            "market": ["Global", "Global", "United States"],
            "viability_score": [0.9, 0.88, 0.5],
            "completion_prediction": [0.8, 0.78, 0.4],
            "cultural_risk_score": [0.2, 0.22, 0.6],
            "risk_category": ["LOW", "LOW", "ELEVATED"],
            "music_momentum_score": [0.84, 0.82, 0.6],
        }
    ).write_parquet(data_dir / "scripts_150k.parquet")

    memory = historical_memory_evidence(
        data_dir=data_dir,
        seed_asset={
            "script_id": "script_000001",
            "genre_primary": "Drama",
            "platform_fit": "Streaming",
            "target_demo": "Gen Z",
            "market": "Global",
            "viability_score": 0.9,
            "cultural_risk_score": 0.2,
        },
        limit=2,
    )
    tool_memory = query_historical_memory(data_dir=str(data_dir), seed_asset=memory["matches"][0], limit=1)

    assert memory["evidence_type"] == "historical_memory"
    assert memory["matches"][0]["script_id"] == "script_000002"
    assert memory["matches"][0]["memory_period"].startswith("202")
    assert tool_memory["matches"]


def test_knowledge_search_filters_by_tribe_and_verdict(tmp_path: Path) -> None:
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    pl.DataFrame(
        {
            "script_id": ["script_000001", "script_000002", "script_000003"],
            "title": ["Dawn Signal", "Night Signal", "Archive Memo"],
            "genre_primary": ["Romance", "Thriller", "Documentary"],
            "platform_fit": ["Streaming", "FAST", "Broadcast"],
            "target_demo": ["Gen Z", "Millennial", "Prestige Adult"],
            "market": ["Global", "Global", "United States"],
            "viability_score": [0.91, 0.54, 0.72],
            "completion_prediction": [0.86, 0.42, 0.68],
            "cultural_risk_score": [0.19, 0.72, 0.24],
            "risk_category": ["LOW", "HIGH", "LOW"],
            "music_momentum_score": [0.85, 0.5, 0.62],
        }
    ).write_parquet(data_dir / "scripts_150k.parquet")

    evidence = knowledge_search_evidence(
        data_dir=data_dir,
        query="Dawn",
        style_tribe="The Etherealists",
        verdict="Greenlight",
        limit=5,
    )
    tool_evidence = search_living_knowledge(data_dir=str(data_dir), verdict="Reconsider", limit=5)

    assert evidence["evidence_type"] == "living_knowledge_search"
    assert evidence["items"][0]["title"] == "Dawn Signal"
    assert evidence["items"][0]["style_tribe"] == "The Etherealists"
    assert evidence["items"][0]["verdict"] == "Greenlight"
    assert evidence["filter_options"]["style_tribes"]
    assert tool_evidence["items"][0]["verdict"] == "Reconsider"


def test_synthesis_supports_reasoning_modes() -> None:
    evidence = {
        "evidence_type": "portfolio_summary",
        "summary": {"records": 1, "avg_viability": 0.77, "avg_cultural_risk": 0.22},
        "top_candidates": [{"script_id": "script_000001"}],
        "benchmark": {"compute_source": "Standard Edge Node"},
    }
    brief = synthesize_evidence(
        evidence=evidence,
        role="executive",
        reasoning_mode="deterministic",
        reasoning_model="nano",
    )

    assert brief["role"] == "executive"
    assert brief["source_evidence"]["liaison_core"]["mode"] == "deterministic"
    assert brief["source_evidence"]["liaison_core"]["reasoning_model"] == "nano"


def test_workspace_payload_supports_filters(tmp_path: Path) -> None:
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    pl.DataFrame(
        {
            "script_id": ["script_000001", "script_000002"],
            "title": ["First", "Second"],
            "genre_primary": ["Drama", "Comedy"],
            "platform_fit": ["Streaming", "FAST"],
            "target_demo": ["Gen Z", "Millennial"],
            "market": ["Global", "United States"],
            "viability_score": [0.9, 0.5],
            "completion_prediction": [0.8, 0.4],
            "cultural_risk_score": [0.2, 0.6],
            "risk_category": ["LOW", "ELEVATED"],
            "music_momentum_score": [0.7, 0.6],
        }
    ).write_parquet(data_dir / "scripts_150k.parquet")
    pl.DataFrame(
        {
            "source_id": ["script_000001"],
            "source_type": ["generated_script"],
            "target_id": ["spotify_00001"],
            "target_type": ["cultural_signal"],
            "edge_type": ["script_cultural_signal"],
            "weight": [0.7],
            "source_name": ["fixture"],
            "source_url": ["local:fixture"],
        }
    ).write_parquet(data_dir / "cultural_graph_edges.parquet")

    payload = workspace_payload(data_dir=data_dir, filters={"genre": "Drama"}, limit=10)
    workspace = payload["streams"]["workspace"]

    assert payload["workspace_type"] == "interactive_media_intelligence"
    assert "accelerated_visuals" in payload
    assert "workspace" in payload["streams"]
    assert workspace["kpis"]["records"] == 1
    assert workspace["table_rows"][0]["genre_primary"] == "Drama"
    assert workspace["table_rows"][0]["budget_tier"] == "Standard"
    assert workspace["table_rows"][0]["emergent_trend"] == "Stable Demand"
    assert workspace["portfolio_assets"][0]["asset_id"] == "script_000001"
    assert workspace["portfolio_assets"][0]["asset_type"] == "script"
    assert workspace["portfolio_assets"][0]["status"] == "rising"
    assert workspace["portfolio_assets"][0]["narrative_atoms"][0]["atom_type"] == "genre"
    assert workspace["clusters"][0]["label"]
    assert workspace["clusters"][0]["color"].startswith("#")
    assert "statuses" in workspace["filter_options"]

    fading_payload = workspace_payload(data_dir=data_dir, filters={"status": "fading"}, limit=10)
    fading_assets = fading_payload["streams"]["workspace"]["portfolio_assets"]
    assert len(fading_assets) == 1
    assert fading_assets[0]["asset_id"] == "script_000002"
    assert all(asset["status"] == "fading" for asset in fading_assets)


def test_accelerated_visuals_report_capabilities_without_rapids() -> None:
    capabilities = accelerated_visual_capabilities()
    result = stand_up_cuxfilter_server(start=False)

    assert set(capabilities["packages"]) == {"cudf", "cuxfilter", "hdbscan"}
    assert result["status"] in {"ready", "unavailable"}
    assert result["spec"]["theme"] == "cuxfilter.themes.dark"
    assert any(chart["column"] == "budget_tier" for chart in result["spec"]["charts"] if "column" in chart)


def test_cultural_signal_network_evidence_scores_scripts(tmp_path: Path) -> None:
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    pl.DataFrame(
        {
            "script_id": ["script_000001", "script_000002", "script_000003"],
            "title": ["Boosted", "Vulnerable", "Unrelated"],
            "genre_primary": ["Drama", "Thriller", "Comedy"],
            "platform_fit": ["Streaming", "FAST", "Broadcast"],
            "target_demo": ["Gen Z", "Millennial", "Gen X"],
            "market": ["Global", "Global", "Global"],
            "runtime_minutes": [105, 80, 92],
            "viability_score": [0.92, 0.45, 0.7],
            "completion_prediction": [0.84, 0.35, 0.65],
            "cultural_risk_score": [0.18, 0.82, 0.25],
            "risk_category": ["LOW", "HIGH", "LOW"],
            "music_momentum_score": [0.88, 0.52, 0.62],
            "audience_behavior_score": [0.76, 0.4, 0.7],
            "prime_time_affinity": [0.5, 0.2, 0.3],
            "cultural_signal_ids": [["signal_a", "signal_b"], ["signal_a"], ["signal_c"]],
        }
    ).write_parquet(data_dir / "scripts_150k.parquet")

    evidence = cultural_signal_network_evidence(signal_id="signal_a", data_dir=data_dir, limit=5)
    tool_evidence = analyze_cultural_signal_network(signal_id="signal_a", data_dir=str(data_dir), limit=5)

    assert evidence["evidence_type"] == "cultural_signal_network"
    assert evidence["summary"]["connected_scripts"] == 2
    assert evidence["boosted_scripts"][0]["script_id"] == "script_000001"
    assert evidence["vulnerable_scripts"][0]["script_id"] == "script_000002"
    assert evidence["graph_engine"]["active_engine"] in {"cuGraph", "NetworkX/Polars"}
    assert tool_evidence["signal_id"] == "signal_a"
    assert set(graph_engine_capabilities()["packages"]) == {"cudf", "cugraph", "networkx"}


def test_market_ingestion_builds_manual_snapshot(tmp_path: Path) -> None:
    out_dir = tmp_path / "out"
    paths = run_market_ingestion(out_dir=out_dir)

    netflix = pl.read_parquet(paths.netflix_movies)
    songs = pl.read_parquet(paths.spotify_songs)
    podcasts = pl.read_parquet(paths.spotify_podcasts)
    signals = pl.read_parquet(paths.market_signals)
    evidence = market_signal_evidence(data_dir=out_dir, limit=3)
    tool_evidence = get_market_signal_evidence(data_dir=str(out_dir), limit=3)

    assert netflix.height == 10
    assert songs.height == 48
    assert podcasts.height == 48
    assert signals.height == 106
    assert songs.get_column("rank").to_list()[:3] == [1, 2, 3]
    assert 29 not in songs.get_column("rank").to_list()
    assert 31 not in podcasts.get_column("rank").to_list()
    assert netflix.filter(pl.col("title") == "Apex").item(0, "runtime_minutes") == 95
    assert songs.filter(pl.col("title") == "Choosin' Texas").item(0, "duration_seconds") == 232
    assert evidence["summary"]["signals"] == 106
    assert tool_evidence["evidence_type"] == "market_signal_snapshot"


def test_operator_workspace_api_route(tmp_path: Path) -> None:
    pytest = __import__("pytest")
    fastapi_testclient = pytest.importorskip("fastapi.testclient")
    from server.api_server import app

    client = fastapi_testclient.TestClient(app)
    response = client.get("/operator-workspace")
    status_response = client.get("/accelerated-workspace/status")
    gpu_demo_response = client.get("/gpu-demo/status")
    omni_response = client.get("/omni-station/status")
    contract_response = client.get("/frontend-contract")
    health_response = client.get("/health")
    public_config_response = client.get("/config/public")
    model_adapters_response = client.get("/models/adapters")
    model_preview_response = client.post(
        "/models/preview-switch",
        json={
            "provider": "openai-compatible",
            "model": "customer-hosted-reasoner",
            "auth_mode": "customer_managed",
            "purpose": "executive_brief",
        },
    )
    readiness_response = client.get("/demo/readiness")
    workflow_response = client.get("/demo/workflow-run")
    cors_response = client.options(
        "/interactive-workspace",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 200
    assert status_response.status_code == 200
    assert gpu_demo_response.status_code == 200
    assert omni_response.status_code == 200
    assert contract_response.status_code == 200
    assert health_response.status_code == 200
    assert public_config_response.status_code == 200
    assert model_adapters_response.status_code == 200
    assert model_preview_response.status_code == 200
    assert readiness_response.status_code == 200
    assert workflow_response.status_code == 200
    assert cors_response.status_code == 200
    assert "Operator Workspace" in response.text
    assert omni_response.json()["status"] == "connected"
    assert omni_response.json()["gpu_demo"]["demo_profile"] == "GPU/RAPIDS/NAT"
    assert contract_response.json()["consumers"] == ["Lovable Frontend", "Omni Station"]
    assert "market_signals" in contract_response.json()["routes"]
    assert "knowledge_search" in contract_response.json()["routes"]
    assert "gpu_demo_status" in contract_response.json()["routes"]
    assert "datasets" in contract_response.json()["routes"]
    assert "dataset_download" in contract_response.json()["routes"]
    assert "autonomous_intake" in contract_response.json()["routes"]
    assert "insight_run_stream" in contract_response.json()["routes"]
    assert "demo_readiness" in contract_response.json()["routes"]
    assert "public_config" in contract_response.json()["routes"]
    assert "model_adapters" in contract_response.json()["routes"]
    assert "model_preview_switch" in contract_response.json()["routes"]
    assert "demo_workflow_run" in contract_response.json()["routes"]
    assert "/config/public" in omni_response.json()["routes"]
    assert "/models/adapters" in omni_response.json()["routes"]
    assert "/models/preview-switch" in omni_response.json()["routes"]
    assert "/demo/readiness" in omni_response.json()["routes"]
    assert "/demo/workflow-run" in omni_response.json()["routes"]
    assert health_response.json()["status"] == "ok"
    assert "gpu_demo" in health_response.json()
    assert "ops" in health_response.json()
    assert "nim" in health_response.json()["ops"]
    assert "polars" in health_response.json()["ops"]
    assert "graph" in health_response.json()["ops"]
    assert "gpu" in health_response.json()["ops"]
    public_config = public_config_response.json()
    public_config_text = public_config_response.text
    assert public_config["secrets_exposed"] is False
    assert public_config["deployment"]["lovable_supported"] is True
    assert public_config["deployment"]["ngrok_supported"] is True
    assert "https://aura-intelligence-flow.lovable.app" in public_config["deployment"]["explicit_origins"]
    assert "http://127.0.0.1:8081" in public_config["deployment"]["explicit_origins"]
    assert "/demo/workflow-run" in public_config["api"]["public_routes"]
    assert public_config["architecture_positioning"]["components"]["nat"]["foreground"] is True
    assert public_config["architecture_positioning"]["components"]["nemotron"]["foreground"] is True
    assert public_config["architecture_positioning"]["components"]["nemotron"]["aliases"] == {
        "nano": "nvidia/nvidia-nemotron-nano-9b-v2"
    }
    assert public_config["reasoning"]["model_aliases"] == {
        "nano": "nvidia/nvidia-nemotron-nano-9b-v2"
    }
    assert public_config["model_adapters"]["active_adapter"]["model"] == "nvidia/nvidia-nemotron-nano-9b-v2"
    assert public_config["model_adapters"]["bring_your_own_model"]["preview_only"] is True
    assert model_adapters_response.json()["active_adapter"]["runtime_locked"] is True
    assert model_adapters_response.json()["bring_your_own_model"]["preview_only"] is True
    assert model_preview_response.json()["preview_only"] is True
    assert model_preview_response.json()["active_runtime_unchanged"] is True
    assert model_preview_response.json()["current_active_model"] == "nvidia/nvidia-nemotron-nano-9b-v2"
    assert model_preview_response.json()["requested_adapter"]["model"] == "customer-hosted-reasoner"
    assert model_preview_response.json()["secrets_exposed"] is False
    assert public_config["architecture_positioning"]["components"]["polars"]["foreground"] is False
    assert public_config["architecture_positioning"]["components"]["rapids"]["foreground"] is False
    assert "proprietary predictive models" in public_config["architecture_positioning"]["demo_boundary"]
    assert "nvapi-" not in public_config_text
    assert "NVIDIA_API_KEY" not in public_config_text
    assert readiness_response.json()["status"] in {"ready", "degraded"}
    assert readiness_response.json()["secrets_exposed"] is False
    assert workflow_response.json()["status"] == "complete"
    assert workflow_response.json()["secrets_exposed"] is False
    assert workflow_response.json()["shared_asset_id"]
    assert len(workflow_response.json()["timeline"]) >= 5
    assert set(readiness_response.json()["phases"]) == {
        "phase_1_operational_trust",
        "phase_2_agentic_orchestration",
        "phase_3_dynamic_knowledge",
        "phase_4_dispatch_loop",
    }
    assert cors_response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_persona_api_contracts() -> None:
    pytest = __import__("pytest")
    fastapi_testclient = pytest.importorskip("fastapi.testclient")
    from server.api_server import app

    client = fastapi_testclient.TestClient(app)
    brief_response = client.post(
        "/generate-brief",
        json={"candidate_limit": 2, "white_label": {"brand_name": "Test Brand", "theme": {}}},
    )
    workspace_response = client.post(
        "/interactive-workspace",
        json={"limit": 2, "filters": {"budget_tier": "Premium"}},
    )
    network_response = client.post(
        "/network-graph/analyze",
        json={"signal_id": "spotify_00001", "limit": 2},
    )
    market_response = client.post("/market-signals", json={"limit": 3})
    knowledge_response = client.post("/knowledge/search", json={"query": "Momentum", "limit": 3})
    autonomous_response = client.get("/autonomous-intake/feed?limit=3")
    stream_response = client.get("/insight-runs/stream?candidate_limit=2")
    readiness_response = client.get("/demo/readiness")
    workflow_response = client.get("/demo/workflow-run")
    dispatch_response = client.post(
        "/dispatch/executive-brief",
        json={
            "candidate_limit": 2,
            "reasoning_mode": "deterministic",
            "reasoning_model": "nano",
            "recipients": ["client@example.com"],
            "template": "<h1>{{brand_name}}</h1><p>{{headline}}</p><ul><li>{{bullet_one}}</li><li>{{bullet_two}}</li><li>{{bullet_three}}</li></ul>",
            "output_formats": ["html", "pdf", "slides"],
            "auto_verify": True,
            "white_label": {"brand_name": "Aura Intelligence", "theme": {}},
        },
    )
    tools_response = client.get("/orchestrator/tools")
    datasets_response = client.get("/datasets")
    dataset_csv_response = client.get("/datasets/scripts_150k.parquet/download?format=csv")
    dataset_json_response = client.get("/datasets/scripts_150k.parquet/download?format=json")

    assert brief_response.status_code == 200
    assert brief_response.json()["white_label"]["brand_name"] == "Test Brand"
    assert "headline" in brief_response.json()["result"]
    assert "brief_bullets" in brief_response.json()["result"]
    assert workspace_response.status_code == 200
    assert "workspace" in workspace_response.json()["result"]["streams"]
    assert workspace_response.json()["result"]["streams"]["workspace"]["filters"]["budget_tier"] == "Premium"
    assert "table_rows" in workspace_response.json()["result"]["streams"]["workspace"]
    assert "portfolio_assets" in workspace_response.json()["result"]["streams"]["workspace"]
    if workspace_response.json()["result"]["streams"]["workspace"]["portfolio_assets"]:
        asset = workspace_response.json()["result"]["streams"]["workspace"]["portfolio_assets"][0]
        assert asset["status"] in {"rising", "peaking", "fading"}
        assert asset["narrative_atoms"]
    assert network_response.status_code == 200
    assert market_response.status_code == 200
    assert knowledge_response.status_code == 200
    assert autonomous_response.status_code == 200
    assert stream_response.status_code == 200
    assert readiness_response.status_code == 200
    assert workflow_response.status_code == 200
    assert dispatch_response.status_code == 200
    assert tools_response.status_code == 200
    assert datasets_response.status_code == 200
    assert dataset_csv_response.status_code == 200
    assert dataset_json_response.status_code == 200
    assert network_response.json()["result"]["evidence_type"] == "cultural_signal_network"
    assert market_response.json()["result"]["evidence_type"] == "market_signal_snapshot"
    assert knowledge_response.json()["result"]["evidence_type"] == "living_knowledge_search"
    assert "items" in knowledge_response.json()["result"]
    assert len(brief_response.json()["result"]["reasoning_trace"]) >= 5
    assert brief_response.json()["result"]["memory_matches"]
    assert autonomous_response.json()["feed_type"] == "autonomous_intake"
    assert len(autonomous_response.json()["items"]) == 3
    assert "event: trace" in stream_response.text
    assert "event: result" in stream_response.text
    assert readiness_response.json()["phases"]["phase_4_dispatch_loop"]["ready"] is True
    assert readiness_response.json()["phases"]["phase_4_dispatch_loop"]["dispatch_status"] == "sent"
    workflow = workflow_response.json()
    assert workflow["mode"] == "autonomous_workflow_simulation"
    assert workflow["architecture_positioning"]["primary_story"].startswith("NAT-orchestrated")
    assert workflow["architecture_positioning"]["components"]["client_models"]["foreground"] is False
    assert workflow["shared_asset_id"] == workflow["shared_insight_package"]["asset_id"]
    assert workflow["intake"]["asset"]["script_id"] == workflow["shared_asset_id"]
    assert workflow["surfaces"]["executive_email"]["status"] == "sent"
    assert workflow["surfaces"]["operator_workspace"]["status"] == "published"
    assert workflow["surfaces"]["communication_lab"]["status"] == "auto_verified"
    assert workflow["shared_insight_package"]["reasoning_trace"]
    assert workflow["shared_insight_package"]["memory_matches"]
    assert dispatch_response.json()["result"]["dispatch_ready"] is True
    assert dispatch_response.json()["result"]["dispatch_status"] == "sent"
    assert dispatch_response.json()["result"]["auto_verified"] is True
    assert "Aura Intelligence" in dispatch_response.json()["result"]["html_body"]
    assert dispatch_response.json()["result"]["rendered_template"]
    assert {artifact["format"] for artifact in dispatch_response.json()["result"]["generated_artifacts"]} == {"html", "pdf", "slides"}
    assert dispatch_response.json()["result"]["source_brief"]["reasoning_trace"]
    assert len(dispatch_response.json()["result"]["bullets"]) == 3
    assert dispatch_response.json()["result"]["recipients"] == ["client@example.com"]
    assert "Greenlight Brief" in dispatch_response.json()["result"]["subject"]
    assert tools_response.json()["orchestrator_profile"] == "miranda-compatible"
    assert len(tools_response.json()["liaison_core"]["tools"]) >= 3
    assert datasets_response.json()["secrets_exposed"] is False
    assert any(item["dataset_id"] == "scripts_150k.parquet" for item in datasets_response.json()["items"])
    assert "script_id" in dataset_csv_response.text.splitlines()[0]
    assert dataset_json_response.headers["content-type"].startswith("application/json")
    assert network_response.json()["result"]["graph_engine"]["compute_source"] in {
        "High-Performance Compute Cluster",
        "Standard Edge Node",
    }


def test_miranda_canonical_demo_questions_are_curated() -> None:
    pytest = __import__("pytest")
    fastapi_testclient = pytest.importorskip("fastapi.testclient")
    from server.api_server import app

    client = fastapi_testclient.TestClient(app)
    questions = {
        "What genres and subcultures should we bet on in the next 6-12 months?": [
            "Grounded sci-fi",
            "Small-town romance",
            "Risk",
            "Next action",
        ],
        "Which emerging audience markets are underserved?": [
            "Nollywood",
            "Korean-language",
            "Indian regional-language",
            "Risk",
            "Next action",
        ],
        "What should we avoid greenlighting right now?": [
            "Avoid greenlighting",
            "Watch-outs",
            "Evidence",
            "Next action",
        ],
    }

    for question, expected_terms in questions.items():
        response = client.post(
            "/miranda/chat",
            json={
                "messages": [{"role": "user", "content": question}],
                "reasoning_mode": "auto",
                "reasoning_model": "nano",
            },
        )
        payload = response.json()
        reply = payload["result"]["reply"]
        assert response.status_code == 200
        assert payload["result"]["mode"] == "curated_demo_response"
        assert len(reply) > 300
        assert all(term in reply for term in expected_terms)
