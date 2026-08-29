import math

import pytest

from tile_takeoff.cutting import (
    Takeoff,
    compare_standard_sizes,
    fit_to_floor,
    parse_dimensions,
    recommend,
    tiles_per_slab,
    zero_waste_options,
)


class TestParseDimensions:
    @pytest.mark.parametrize(
        "text", ["295x175", "295X175", "295 x 175", "295×175", "295*175"]
    )
    def test_accepts_common_separators(self, text):
        assert parse_dimensions(text) == (295.0, 175.0)

    def test_keeps_decimals(self):
        assert parse_dimensions("147.5x87.5") == (147.5, 87.5)

    @pytest.mark.parametrize("text", ["295", "0x175", "-295x175", "axb"])
    def test_rejects_nonsense(self, text):
        with pytest.raises(ValueError):
            parse_dimensions(text)


class TestZeroWasteOptions:
    def test_every_option_really_wastes_nothing(self):
        options = zero_waste_options(295, 175)
        assert options, "a 295x175 slab has zero-waste cuts in the default range"
        for option in options:
            assert option.waste_fraction(295, 175) == pytest.approx(0.0, abs=1e-9)

    def test_options_stay_within_the_practical_range(self):
        for option in zero_waste_options(295, 175, min_side_cm=40, max_side_cm=150):
            assert 40 - 1e-9 <= min(option.width_cm, option.height_cm)
            assert max(option.width_cm, option.height_cm) <= 150 + 1e-9

    def test_sorted_largest_first(self):
        areas = [o.area_m2 for o in zero_waste_options(295, 175)]
        assert areas == sorted(areas, reverse=True)

    def test_impossible_range_returns_nothing(self):
        assert zero_waste_options(295, 175, min_side_cm=200, max_side_cm=210) == []


class TestRecommend:
    def test_known_slab_gives_the_expected_cut(self):
        """295x175 splits 2x2 into 147.5x87.5 — the reference case."""
        best = recommend(295, 175)
        assert best is not None
        assert (best.width_cm, best.height_cm) == (147.5, 87.5)
        assert best.per_slab == 4
        assert best.area_m2 == pytest.approx(1.290625)

    def test_returns_none_when_no_cut_fits(self):
        assert recommend(295, 175, min_side_cm=200, max_side_cm=210) is None

    def test_room_breaks_ties_without_changing_the_largest_area(self):
        plain = recommend(295, 175)
        with_room = recommend(295, 175, floor_width_cm=1050, floor_height_cm=810)
        assert with_room is not None and plain is not None
        assert with_room.area_m2 == pytest.approx(plain.area_m2)


class TestFitToFloor:
    def test_borders_are_the_true_remainders(self):
        fit = fit_to_floor(147.5, 87.5, 1050, 810)
        assert fit.border_across_cm == pytest.approx(
            1050 - fit.courses_across * fit.tile_width_cm
        )
        assert fit.border_up_cm == pytest.approx(810 - fit.courses_up * fit.tile_height_cm)

    def test_borders_are_never_negative(self):
        fit = fit_to_floor(147.5, 87.5, 1050, 810)
        assert fit.border_across_cm >= 0 and fit.border_up_cm >= 0

    def test_picks_the_orientation_with_less_offcut(self):
        chosen = fit_to_floor(147.5, 87.5, 1050, 810)
        flipped = fit_to_floor(87.5, 147.5, 1050, 810)
        assert chosen.total_border_cm <= flipped.total_border_cm + 1e-9

    def test_a_tile_wider_than_the_room_lays_no_courses(self):
        fit = fit_to_floor(200, 200, 150, 150)
        assert fit.courses_across == 0 and fit.courses_up == 0


class TestTilesPerSlab:
    def test_tries_both_orientations(self):
        assert tiles_per_slab(295, 175, 60, 120) == tiles_per_slab(295, 175, 120, 60)

    def test_oversized_tile_does_not_fit(self):
        assert tiles_per_slab(295, 175, 300, 300) == 0

    def test_counts_only_whole_tiles(self):
        # 295//60 = 4 across, 175//60 = 2 up
        assert tiles_per_slab(295, 175, 60, 60) == 8


class TestStandardSizes:
    def test_waste_is_a_sane_fraction(self):
        for _w, _h, count, waste in compare_standard_sizes(295, 175):
            assert 0.0 <= waste <= 1.0
            assert count >= 0


class TestTakeoff:
    def test_rounds_up_never_down(self):
        quantities = Takeoff(area_m2=98, tile_area_m2=1.290625, slab_area_m2=5.1625)
        assert quantities.tiles_needed == math.ceil(98 / 1.290625)
        assert quantities.tiles_needed * 1.290625 >= 98

    def test_allowance_never_reduces_the_order(self):
        quantities = Takeoff(98, 1.290625, 5.1625, allowance=0.10)
        assert quantities.slabs_with_allowance >= quantities.slabs_bare

    def test_zero_allowance_matches_the_bare_count(self):
        quantities = Takeoff(98, 1.290625, 5.1625, allowance=0.0)
        assert quantities.slabs_with_allowance == quantities.slabs_bare

    def test_reference_case(self):
        """98 m² off a 295x175 slab: about 76 tiles, 21 slabs with 10% allowance."""
        quantities = Takeoff(98, 1.290625, 5.1625, allowance=0.10)
        assert quantities.tiles_needed == 76
        assert quantities.slabs_with_allowance == 21
